import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Ctx = { params: { id?: string } | Promise<{ id?: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
    const resolvedParams = await Promise.resolve(ctx.params);
    const id = resolvedParams?.id;

    if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase
        .from('automations')
        .update({
            deleted_at: new Date().toISOString(),
            status: 'deleted' // Helpful for UI status check
        })
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) {
        console.error("Soft delete error:", error);
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
