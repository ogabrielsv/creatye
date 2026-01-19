import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: { id?: string } | Promise<{ id?: string }> };

const fail = (step: string, error: any) => {
    console.error(`[API] ${step}`, error);
    return NextResponse.json(
        { error: "request_failed", step, details: error?.message ?? String(error) },
        { status: 500 }
    );
};

export async function GET(req: Request, ctx: Ctx) {
    const resolvedParams = await Promise.resolve(ctx.params);
    const id = resolvedParams?.id;

    if (!id || id === "undefined") {
        console.log("[API] Invalid automation id param", { id });
        return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user) {
        console.log("[API] Unauthorized access to /api/automations/[id]", { authError });
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();

    if (error) return fail("select automations", error);
    if (!data) return NextResponse.json({ error: "Automation not found" }, { status: 404 });

    const { data: draft, error: draftErr } = await supabase
        .from("automation_drafts")
        .select("nodes, edges")
        .eq("automation_id", id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (draftErr) return fail("select automation_drafts", draftErr);

    return NextResponse.json({
        ...data,
        nodes: draft?.nodes || [],
        edges: draft?.edges || []
    });
}

export async function PUT(req: Request, ctx: Ctx) {
    const resolvedParams = await Promise.resolve(ctx.params);
    const id = resolvedParams?.id;

    if (!id || id === "undefined") {
        return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user) {
        console.log("[API] Unauthorized PUT /api/automations/[id]", { authError });
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { nodes, edges, status } = body;

    // 1) Update status
    if (status) {
        const { error: updateError } = await supabase
            .from("automations")
            .update({
                status,
                published_at: status === "published" ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .eq("user_id", user.id)
            .is("deleted_at", null);

        if (updateError) return fail("update automations status", updateError);
    }

    // 2) Save draft
    const { error: upsertDraftErr } = await supabase
        .from("automation_drafts")
        .upsert(
            {
                automation_id: id,
                user_id: user.id,
                nodes: nodes || [],
                edges: edges || [],
                updated_at: new Date().toISOString()
            },
            { onConflict: "automation_id" }
        );

    if (upsertDraftErr) return fail("upsert automation_drafts", upsertDraftErr);

    // 3) Sync relational config if published
    if (status === "published" && Array.isArray(nodes) && nodes.length > 0) {

        // --- Validation & Preparation ---
        const triggersToInsert: any[] = [];
        const actionsToInsert: any[] = [];

        // Check context for channel
        const triggerNodes = nodes.filter((n: any) => n.type === 'triggerNode');
        const isCommentChannel = triggerNodes.some((n: any) => n.data?.triggerType === 'comment_keyword');

        for (const node of nodes) {
            // Trigger Node
            if (node.type === "triggerNode") {
                const tData = node.data || {};
                const kw = (tData.keyword || tData.text || '').trim();
                const tType = tData.triggerType || 'dm_keyword';

                if (kw || tType === 'story_mention') {
                    triggersToInsert.push({
                        automation_id: id,
                        user_id: user.id,
                        trigger_type: "keyword", // Internal type
                        trigger_filter: {
                            keyword: kw,
                            match_mode: (tData.matchType || tData.match_mode || 'contains').toLowerCase(),
                            case_insensitive: true,
                            // Critical Fields for Comment Feed:
                            channel: tType === 'comment_keyword' ? 'comment_feed' : 'dm',
                            target_mode: tData.targetMode || 'any',
                            target_media_id: tData.targetMediaId || null
                        },
                        metadata: { type: tType }
                    });
                }
            }

            // Action Node
            if (node.type === "actionNode" || node.type === "message") {
                const msg = node.data?.message || node.data?.text;
                if (msg) {
                    actionsToInsert.push({
                        automation_id: id,
                        user_id: user.id,
                        kind: isCommentChannel ? 'reply_comment' : 'send_dm',
                        message_text: msg
                    });
                }
            }
            else if (node.type === 'buttons' && node.data?.buttons?.length) {
                actionsToInsert.push({
                    automation_id: id,
                    user_id: user.id,
                    kind: 'buttons',
                    message_text: node.data.message || 'Opções',
                    metadata: { buttons: node.data.buttons }
                });
            }
            else if (node.type === 'cards' && node.data?.cards?.length) {
                actionsToInsert.push({
                    automation_id: id,
                    user_id: user.id,
                    kind: 'cards',
                    message_text: 'Ver opções',
                    metadata: { cards: node.data.cards }
                });
            }
        }

        if (triggersToInsert.length === 0) {
            await supabase.from('automations').update({ status: 'draft' }).eq('id', id);
            return NextResponse.json({
                error: "validation_error",
                details: "Sua automação publicada precisa ter pelo menos 1 gatilho."
            }, { status: 400 });
        }

        // --- Create Version Snapshot ---
        const { data: version, error: verError } = await supabase
            .from('automation_versions')
            .insert({
                automation_id: id,
                user_id: user.id,
                channel: isCommentChannel ? 'comment_feed' : 'dm',
                nodes: nodes,
                edges: edges || []
            })
            .select('id')
            .single();

        if (verError) return fail("create version", verError);

        // Update Published Version ID
        await supabase.from('automations').update({ published_version_id: version.id }).eq('id', id);

        // --- DESTRUCTIVE SYNC (Safe now) ---
        const { error: delTrigErr } = await supabase
            .from("automation_triggers")
            .delete()
            .eq("automation_id", id)
            .eq("user_id", user.id);
        if (delTrigErr) return fail("delete automation_triggers", delTrigErr);

        const { error: delActErr } = await supabase
            .from("automation_actions")
            .delete()
            .eq("automation_id", id)
            .eq("user_id", user.id);
        if (delActErr) return fail("delete automation_actions", delActErr);

        // Insert New
        if (triggersToInsert.length > 0) {
            const { error: trigErr } = await supabase
                .from("automation_triggers")
                .insert(triggersToInsert);
            if (trigErr) return fail("insert automation_triggers", trigErr);
        }

        if (actionsToInsert.length > 0) {
            const { error: actErr } = await supabase
                .from("automation_actions")
                .insert(actionsToInsert);
            if (actErr) return fail("insert automation_actions", actErr);
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

    // Soft Delete
    const { error } = await supabase
        .from('automations')
        .update({
            deleted_at: new Date().toISOString(),
            status: 'deleted'
        })
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) return fail("soft delete automation", error);

    return NextResponse.json({ success: true })
}
