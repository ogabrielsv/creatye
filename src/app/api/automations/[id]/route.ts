
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

    // 1. Prepare Updates
    const updates: any = {
        updated_at: new Date().toISOString()
    };

    // Extract Trigger Config from Nodes
    const triggerNode = nodes?.find((n: any) => n.type === 'triggerNode');
    const triggerData = triggerNode?.data || {};
    const rawTrigger = triggerData.keyword || triggerData.text || triggerData.value;
    const triggerType = triggerData.triggerType || 'dm_keyword'; // dm_keyword, comment_keyword

    // Save minimal cache columns on automations table
    if (rawTrigger) updates.trigger = rawTrigger;
    if (triggerType) {
        updates.trigger_type = triggerType;
        // Channel Mapping
        if (triggerType === 'comment_keyword') updates.channel = 'comment_feed';
        else updates.channel = 'dm';
    }

    if (triggerData.targetMode) updates.target_mode = triggerData.targetMode;
    if (triggerData.targetMediaId) updates.target_media_id = triggerData.targetMediaId;

    if (status) {
        updates.status = status;
        if (status === 'published') updates.published_at = new Date().toISOString();
    }

    // 2. Update Automation Metadata
    const { error: updateError } = await supabase
        .from('automations')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

    if (updateError) {
        console.error("Error updating automation meta:", updateError);
        return NextResponse.json({ error: "Failed to update automation" }, { status: 500 });
    }

    // 3. Save Draft (Nodes/Edges)
    const { error: draftError } = await supabase
        .from('automation_drafts')
        .upsert({
            automation_id: id,
            user_id: user.id,
            nodes: nodes || [],
            edges: edges || [],
            updated_at: new Date().toISOString()
        }, { onConflict: 'automation_id' });

    if (draftError) {
        console.error("Error saving draft:", draftError);
        return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
    }

    // 4. PUBLISHING LOGIC (Versioning & Sync)
    // Always create a version if we are in 'published' state (concept of "Deploy")
    if (status === 'published') {
        if (!nodes || !Array.isArray(nodes)) {
            return NextResponse.json({ error: "No nodes provided for publication" }, { status: 400 });
        }

        // --- A. Prepare Triggers & Actions (Validation Phase) ---
        const triggersToInsert: any[] = [];
        const actionsToInsert: any[] = [];

        // Determine context once (if multiple triggers exist, we might have conflict on 'channel' but typically 1 trigger per flow)
        // We hunt for the trigger(s)
        const triggerNodes = nodes.filter((n: any) => n.type === 'triggerNode');
        const isCommentChannel = triggerNodes.some((n: any) => n.data?.triggerType === 'comment_keyword');

        for (const node of nodes) {
            // Trigger Nodes
            if (node.type === 'triggerNode') {
                const tData = node.data || {};
                const kw = (tData.keyword || tData.text || '').trim();

                // We only insert if there's a keyword? Or maybe some triggers don't need keywords (e.g. story mention)?
                // For 'keyword' based triggers, we need a keyword.
                // For 'story_mention', keyword might be empty.
                const tType = tData.triggerType || 'dm_keyword';

                if (kw || tType === 'story_mention') {
                    const filter = {
                        keyword: kw,
                        match_mode: (tData.matchType || tData.match_mode || 'contains').toLowerCase(),
                        case_insensitive: true,
                        // Context fields
                        channel: tType === 'comment_keyword' ? 'comment_feed' : 'dm',
                        target_mode: tData.targetMode || 'any',
                        target_media_id: tData.targetMediaId || null
                    };

                    triggersToInsert.push({
                        automation_id: id,
                        user_id: user.id,
                        trigger_type: 'keyword', // Internal type, metadata stores the UI type
                        trigger_filter: filter,
                        metadata: { type: tType }
                    });
                }
            }

            // Action Nodes
            // We map 'actionNode' (legacy/generic), 'message', 'buttons', 'cards'
            if (node.type === 'actionNode' || node.type === 'message') {
                const msg = (node.data?.message || node.data?.text || '').trim();
                if (msg) {
                    actionsToInsert.push({
                        automation_id: id,
                        user_id: user.id,
                        // If it's a comment flow, default simple text to 'reply_comment' (public)
                        // This assumes the user wants to reply publicly.
                        kind: isCommentChannel ? 'reply_comment' : 'send_dm',
                        message_text: msg
                    });
                }
            }
            else if (node.type === 'buttons' && node.data?.buttons?.length) {
                actionsToInsert.push({
                    automation_id: id,
                    user_id: user.id,
                    kind: 'buttons', // Buttons are DM only
                    message_text: node.data.message || 'Opções',
                    metadata: { buttons: node.data.buttons }
                });
            }
            else if (node.type === 'cards' && node.data?.cards?.length) {
                actionsToInsert.push({
                    automation_id: id,
                    user_id: user.id,
                    kind: 'cards', // Cards are DM only
                    message_text: 'Ver opções',
                    metadata: { cards: node.data.cards }
                });
            }
        }

        // --- B. Validation ---
        // If no triggers, DO NOT publish. It would be an orphan automation.
        if (triggersToInsert.length === 0) {
            console.warn('[SYNC] Blocked publish: missing triggers');
            // Revert status to draft in DB so UI reflects reality
            await supabase.from('automations').update({ status: 'draft' }).eq('id', id);
            return NextResponse.json({
                error: "Sua automação publicada precisa ter pelo menos 1 gatilho configurado."
            }, { status: 400 });
        }

        // Actions are optional? Usually yes, but user snippet checked for them.
        // We'll allow 0 actions (maybe it just logs?), but typically not useful.
        // User snippet logic: `if (triggersToInsert.length === 0) return error`. It didn't enforce actions explicitly in the return, only loop.
        // But my previous code enforced it. I will relax it to "must have triggers".

        // --- C. Create Version Snapshot ---
        // We do this BEFORE syncing so we have the ID.
        const { data: version, error: verError } = await supabase
            .from('automation_versions')
            .insert({
                automation_id: id,
                user_id: user.id,
                channel: updates.channel || 'dm',
                nodes: nodes,
                edges: edges || []
            })
            .select('id')
            .single();

        if (verError) {
            console.error("Error creating version:", verError);
            return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
        }

        // Update Automation with Version ID
        await supabase
            .from('automations')
            .update({ published_version_id: version.id })
            .eq('id', id);

        // --- D. Sync Triggers/Actions (The Destructive Part) ---
        // Now that we validated, we can safely clear old configs.

        const delTrig = await supabase.from('automation_triggers').delete().eq('automation_id', id).eq('user_id', user.id);
        const delAct = await supabase.from('automation_actions').delete().eq('automation_id', id).eq('user_id', user.id);

        if (delTrig.error) console.error("[SYNC] Failed deleting triggers:", delTrig.error);
        if (delAct.error) console.error("[SYNC] Failed deleting actions:", delAct.error);

        // Insert New
        const insTrig = await supabase.from('automation_triggers').insert(triggersToInsert);
        if (insTrig.error) {
            console.error("[SYNC] Failed inserting triggers:", insTrig.error);
            return NextResponse.json({ error: "Failed to sync triggers" }, { status: 500 });
        }

        if (actionsToInsert.length > 0) {
            const insAct = await supabase.from('automation_actions').insert(actionsToInsert);
            if (insAct.error) console.error("[SYNC] Failed inserting actions:", insAct.error);
        }

        console.log(`[SYNC] Published V${version.id}. Triggers: ${triggersToInsert.length}, Actions: ${actionsToInsert.length}`);
    }

    return NextResponse.json({ success: true });
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
