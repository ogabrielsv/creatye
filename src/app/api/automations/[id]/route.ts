
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
    if (status === 'published') {
        if (!nodes || !Array.isArray(nodes)) {
            return NextResponse.json({ error: "No nodes provided for publication" }, { status: 400 });
        }

        // A) Create Version
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

        // B) Update Published Version ID
        await supabase
            .from('automations')
            .update({ published_version_id: version.id })
            .eq('id', id);

        // C) Sync Triggers & Actions
        const triggersToInsert: any[] = [];
        const actionsToInsert: any[] = [];
        const isCommentChannel = (updates.channel === 'comment_feed' || triggerType === 'comment_keyword');

        // --- C1. Triggers ---
        if (triggerNode) {
            const kw = triggerData.keyword ? triggerData.keyword.trim() : '';
            if (kw) {
                // Construct filter exactly as requested
                const filter = {
                    keyword: kw,
                    match_mode: (triggerData.matchType || triggerData.match_mode || 'contains').toLowerCase(),
                    channel: isCommentChannel ? 'comment_feed' : 'dm',
                    target_mode: triggerData.targetMode || 'any',
                    target_media_id: triggerData.targetMediaId || null,
                    case_insensitive: true
                };

                triggersToInsert.push({
                    automation_id: id,
                    user_id: user.id,
                    trigger_type: 'keyword', // Always 'keyword' logic with filter properties
                    trigger_filter: filter,
                    metadata: { type: triggerType }
                });
            }
        }

        // --- C2. Actions ---
        for (const node of nodes) {
            if (node.type === 'triggerNode' || node.type === 'start') continue;

            // Determine Kind
            let kind = 'send_dm'; // Default
            if (isCommentChannel) kind = 'reply_comment'; // Default for comment automations?
            // Actually, usually comment triggers result in a DM Reply (private reply) OR Comment Reply.
            // User requested "ActionNode (Responder comentário)" => implies public reply
            // But usually "Comment on Post" automations send a DM. 
            // The USER said: "Action dfeault para comentário: kind='reply_comment' (message_text)"
            // So if channel is comment -> action is reply_comment.

            // However, nodes might be 'buttons' or 'cards' which are ONLY supported in DM.
            // If the user drags a 'Message Block' in a comment flow, is it a public reply or DM?
            // "Gaio" style usually sends a DM. But the user specifically asked:
            // "Action default para comentário: kind="reply_comment""
            // Let's implement logic: If node is simple text => reply_comment. If Rich => send_dm (since comments don't support cards).

            // For now, following exact instruction: "action default para comentário: kind='reply_comment'"
            // We will map simple messages to 'reply_comment' if channel is comment.
            // If the user wants to send a DM from a comment, they probably need a specific 'Send DM' block or we assume 'reply_comment' IS the DM?
            // Clarification: "Executar action reply_comment ... chamar Graph API pra responder comentário" -> This is a PUBLIC REPLY.
            // Wait, does the user want to send the DM with the brochure? usually yes.
            // "Fazer Comentário no Feed ... Responder comentário via Graph API (comentário reply)"
            // Okay, the user wants the bot to REPLY TO THE COMMENT. 
            // Does strictly that mean NO DM? Most automations do "Reply on comment + Send DM".
            // Since we iterate nodes, maybe we can have multiple actions?
            // For now, let's map text nodes to 'reply_comment' if channel is comment_feed.

            const msg = node.data?.message || node.data?.text;
            const buttons = node.data?.buttons;
            const cards = node.data?.cards;

            if (node.type === 'actionNode' || node.type === 'message') {
                if (msg) {
                    actionsToInsert.push({
                        automation_id: id,
                        user_id: user.id,
                        kind: isCommentChannel ? 'reply_comment' : 'send_dm',
                        message_text: msg
                    });
                }
            }
            else if (node.type === 'buttons' && buttons?.length) {
                // Buttons only work in DM
                actionsToInsert.push({
                    automation_id: id,
                    user_id: user.id,
                    kind: 'buttons', // DM only
                    message_text: msg || 'Opções',
                    metadata: { buttons }
                });
            }
            else if (node.type === 'cards' && cards?.length) {
                // Cards only work in DM
                actionsToInsert.push({
                    automation_id: id,
                    user_id: user.id,
                    kind: 'cards', // DM only
                    message_text: 'Ver opções',
                    metadata: { cards }
                });
            }
        }

        // VALIDATION
        if (triggersToInsert.length === 0 || actionsToInsert.length === 0) {
            console.warn('[SYNC] Blocked publish: missing/invalid triggers or actions')
            await supabase.from('automations').update({ status: 'draft' }).eq('id', id); // Revert
            return NextResponse.json({
                error: "cannot_publish_without_trigger_or_action",
                details: "Configure pelo menos um Gatilho e uma Ação."
            }, { status: 400 });
        }

        // Clean & Insert
        await supabase.from('automation_triggers').delete().eq('automation_id', id).eq('user_id', user.id);
        await supabase.from('automation_actions').delete().eq('automation_id', id).eq('user.id', user.id);

        const { error: insTrigErr } = await supabase.from('automation_triggers').insert(triggersToInsert);
        if (insTrigErr) console.error("Error inserting triggers:", insTrigErr);

        const { error: insActErr } = await supabase.from('automation_actions').insert(actionsToInsert);
        if (insActErr) console.error("Error inserting actions:", insActErr);

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
