
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Fetch Automation Metadata
    const { data: automation, error } = await supabase
        .from('automations')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

    if (error || !automation) {
        return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    // Fetch Latest Draft
    const { data: draft } = await supabase
        .from('automation_drafts')
        .select('nodes, edges')
        .eq('automation_id', id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    return NextResponse.json({
        ...automation,
        nodes: draft?.nodes || [],
        edges: draft?.edges || []
    });
}
