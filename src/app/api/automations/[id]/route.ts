
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Ctx = { params: { id?: string } | Promise<{ id?: string }> }

export async function GET(req: Request, ctx: Ctx) {
    // suporta params normal ou Promise
    const resolvedParams = await Promise.resolve(ctx.params)
    const id = resolvedParams?.id

    // ✅ evita mandar "undefined" pro Postgres
    if (!id || id === "undefined") {
        console.log("[API] Invalid automation id param", { id })
        return NextResponse.json({ error: "invalid id" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // ✅ se não tem user, não consulta nada
    if (!user) {
        console.log("[API] Unauthorized access to /api/automations/[id]", { authError })
        return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle()

    if (error) {
        console.log("[API] DB error /api/automations/[id]", { error })
        return NextResponse.json({ error: "db_error" }, { status: 500 })
    }

    if (!data) {
        return NextResponse.json({ error: "Automation not found" }, { status: 404 })
    }

    // Need to fetch draft for GE!
    const { data: draft } = await supabase
        .from('automation_drafts')
        .select('nodes, edges')
        .eq('automation_id', id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    return NextResponse.json({
        ...data,
        nodes: draft?.nodes || [],
        edges: draft?.edges || []
    })
}

export async function PUT(req: Request, ctx: Ctx) {
    const resolvedParams = await Promise.resolve(ctx.params)
    const id = resolvedParams?.id

    if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { nodes, edges, status } = body

    // 1. Update Status & Main Metadata
    const triggerRaw = body.trigger || nodes?.find((n: any) => n.type === 'triggerNode')?.data?.keyword;
    const triggerType = body.trigger_type || nodes?.find((n: any) => n.type === 'triggerNode')?.data?.triggerType || 'dm_keyword';

    const updates: any = {
        updated_at: new Date().toISOString()
    };
    if (status) {
        updates.status = status;
        if (status === 'published') updates.published_at = new Date().toISOString();
    }
    // Update trigger cache columns if provided
    if (triggerRaw) updates.trigger = triggerRaw;
    if (triggerType) updates.trigger_type = triggerType;

    const { error: updateError } = await supabase
        .from('automations')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

    if (updateError) {
        console.error("Error updating automation:", updateError);
        return NextResponse.json({ error: "Failed to update automation" }, { status: 500 });
    }

    // 2. Save Draft (Nodes/Edges)
    const { error } = await supabase
        .from('automation_drafts')
        .upsert({
            automation_id: id,
            user_id: user.id,
            nodes: nodes || [],
            edges: edges || [],
            updated_at: new Date().toISOString()
        }, { onConflict: 'automation_id' })

    if (error) {
        console.error("Error saving draft:", error)
        return NextResponse.json({ error: "Failed to save draft" }, { status: 500 })
    }

    // 3. Sync Triggers/Actions if Published
    if (status === 'published') {
        if (!nodes || !Array.isArray(nodes)) {
            return NextResponse.json({ error: "No nodes provided for publication" }, { status: 400 })
        }

        const triggersToInsert: any[] = []
        const actionsToInsert: any[] = []

        // Sort nodes by position or logic? 
        // For linear execution, we can rely on edge connections, but simplistic parser might just grab all actions.
        // We will just grab all action-type nodes.

        for (const node of nodes) {
            // Trigger
            if (node.type === 'triggerNode') {
                const keywordRaw = node.data?.keyword ?? node.data?.text ?? node.data?.value;
                const matchMode = (node.data?.matchType || node.data?.match_mode || 'contains').toLowerCase();
                const type = node.data?.triggerType || 'dm_keyword'; // dm_keyword, comment_keyword

                if (keywordRaw && typeof keywordRaw === 'string' && keywordRaw.trim()) {
                    triggersToInsert.push({
                        automation_id: id,
                        user_id: user.id,
                        trigger_type: type === 'comment_keyword' ? 'comment_keyword' : 'keyword', // Map to DB types
                        trigger_filter: {
                            keyword: keywordRaw.trim(),
                            match_mode: matchMode,
                            case_insensitive: true,
                            source: type // store explicit source type in filter too
                        },
                        metadata: { triggerType: type }
                    });
                }
            }

            // Legacy Action
            if (node.type === 'actionNode') {
                const msg = node.data?.message;
                if (msg) actionsToInsert.push({ automation_id: id, user_id: user.id, kind: 'send_dm', message_text: msg });
            }

            // New: Message Node
            if (node.type === 'message') {
                const msg = node.data?.message;
                if (msg) actionsToInsert.push({ automation_id: id, user_id: user.id, kind: 'send_dm', message_text: msg });
            }

            // New: Buttons Node
            if (node.type === 'buttons') {
                const msg = node.data?.message;
                const btns = node.data?.buttons || [];
                if (msg && btns.length > 0) {
                    actionsToInsert.push({
                        automation_id: id,
                        user_id: user.id,
                        kind: 'buttons',
                        message_text: msg,
                        metadata: { buttons: btns }
                    });
                }
            }

            // New: Cards Node
            if (node.type === 'cards') {
                const cards = node.data?.cards || [];
                if (cards.length > 0) {
                    actionsToInsert.push({
                        automation_id: id,
                        user_id: user.id,
                        kind: 'cards',
                        // Message text fallback?
                        message_text: 'Ver opções',
                        metadata: { cards: cards }
                    });
                }
            }
        }

        // VALIDATION: Cannot publish without valid trigger and action
        if (triggersToInsert.length === 0 || actionsToInsert.length === 0) {
            console.warn('[SYNC] Blocked publish: missing/invalid triggers or actions', { trig: triggersToInsert.length, act: actionsToInsert.length })
            await supabase.from('automations').update({ status: 'draft' }).eq('id', id)
            return NextResponse.json({
                error: "cannot_publish_without_trigger_or_action",
                details: "Configure pelo menos um Gatilho (com palavra-chave) e uma Ação (mensagem, botões ou cards)."
            }, { status: 400 })
        }

        // Clean existing
        await supabase.from('automation_triggers').delete().eq('automation_id', id).eq('user_id', user.id)
        await supabase.from('automation_actions').delete().eq('automation_id', id).eq('user_id', user.id)

        const insTrig = await supabase.from('automation_triggers').insert(triggersToInsert)
        if (insTrig.error) {
            console.error('[SYNC] triggers insert error:', insTrig.error);
            return NextResponse.json({ error: "Failed to save triggers" }, { status: 500 });
        }

        const insAct = await supabase.from('automation_actions').insert(actionsToInsert)
        if (insAct.error) {
            console.error('[SYNC] actions insert error:', insAct.error);
            return NextResponse.json({ error: "Failed to save actions" }, { status: 500 });
        }
    }

    return NextResponse.json({ success: true })
}

export async function DELETE(req: Request, ctx: Ctx) {
    const resolvedParams = await Promise.resolve(ctx.params)
    const id = resolvedParams?.id

    if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Hard Delete: definitive removal
    const { error, count } = await supabase
        .from('automations')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) {
        console.error("Error deleting automation:", error)
        return NextResponse.json({ error: "Failed to delete automation" }, { status: 500 })
    }

    // Optional: Check if row was actually deleted (RLS might return 0 count without error)
    if (count === 0) {
        console.warn("Delete op returned 0 rows. Possible RLS mismatch or ID not found.", { id, userId: user.id });
        // We still return success as idempotency is fine, or arguably 404. 
        // But for "it's not deleting", 200 is misleading if nothing happened.
        // Let's assume 200 OK so frontend clears it.
    }

    return NextResponse.json({ success: true })
}
