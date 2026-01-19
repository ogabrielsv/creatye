
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

    // 1. Update Status if changed
    if (status) {
        const { error: updateError } = await supabase
            .from('automations')
            .update({
                status: status,
                published_at: status === 'published' ? new Date().toISOString() : undefined,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('user_id', user.id);

        if (updateError) {
            console.error("Error updating status:", updateError);
            return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
        }
    }

    // 2. Save Draft (Nodes/Edges)
    // Upsert logic for automation_drafts
    // Check if draft exists first or just upsert with onConflict on automation_id
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

    return NextResponse.json({ success: true })
}
