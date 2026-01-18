import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = await createClient();

    // 1. Get current draft
    const { data: draft, error: draftError } = await supabase
        .from('automation_drafts')
        .select('*')
        .eq('automation_id', params.id)
        .single();

    if (draftError || !draft) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    const { nodes, edges } = draft;

    // 2. Validation (Backend side)
    const hasStart = nodes.some((n: any) => n.type === 'start');
    if (!hasStart) {
        return NextResponse.json({ error: 'O fluxo precisa de um nó "Início".' }, { status: 400 });
    }

    // 3. Get latest version number
    const { data: versions } = await supabase
        .from('automation_versions')
        .select('version')
        .eq('automation_id', params.id)
        .order('version', { ascending: false })
        .limit(1);

    const nextVersion = (versions && versions.length > 0) ? (versions[0].version + 1) : 1;

    // 4. Create Version Snapshot
    const { error: versionError } = await supabase
        .from('automation_versions')
        .insert({
            automation_id: params.id,
            nodes: nodes,
            edges: edges,
            version: nextVersion,
            is_published: true,
            created_at: new Date().toISOString()
        });

    if (versionError) {
        console.error('Version error', versionError);
        return NextResponse.json({ error: 'Failed to create version' }, { status: 500 });
    }

    // 5. Update Automation status and Live Data
    const { data, error } = await supabase
        .from('automations')
        .update({
            status: 'published',
            last_pub: new Date().toISOString(),
            flow_data: { nodes, edges } // Copy to live column for fast execution
        })
        .eq('id', params.id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
