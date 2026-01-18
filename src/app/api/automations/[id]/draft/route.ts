
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const json = await request.json();
    const { nodes, edges } = json;

    // Validate ownership
    const { data: automation } = await supabase
        .from('automations')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

    if (!automation) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Insert or Update Draft
    // We append a new draft version or update the latest one?
    // For simplicity, let's insert a new version to keep history (or upsert if we want to save space).
    // Let's upsert based on (automation_id) if we want only one draft?
    // Schema `automation_drafts` usually has `id`.
    // Let's just insert for now, keeping history.

    // Check if we already have a draft for today?
    // Actually, just inserting is safer for "undo" later, assuming we clean up. 
    // But for MVP, `upsert` on a unique constraint or just `insert` is fine.
    // Let's check the schema for `automation_drafts`.
    // Schema not strictly visible but usually `id` PK.

    const { error } = await supabase
        .from('automation_drafts')
        .insert({
            automation_id: id,
            user_id: user.id,
            nodes: nodes || [],
            edges: edges || [],
            updated_at: new Date().toISOString()
        });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also update the automation `updated_at`
    await supabase.from('automations').update({ updated_at: new Date().toISOString() }).eq('id', id);

    return NextResponse.json({ success: true });
}
