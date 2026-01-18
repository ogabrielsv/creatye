import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createClient();
    const json = await request.json();
    const { nodes, edges, triggers } = json;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Upsert draft
    const { data, error } = await supabase
        .from('automation_drafts')
        .upsert({
            automation_id: params.id,
            user_id: user.id,
            nodes,
            edges,
            updated_at: new Date().toISOString()
        }, { onConflict: 'automation_id' })
        .select()
        .single();

    // Handle Triggers
    if (triggers) {
        // Clear existing triggers for this automation
        await supabase.from('automation_triggers').delete().eq('automation_id', params.id);

        const triggersArray = Array.isArray(triggers) ? triggers : [triggers];
        if (triggersArray.length > 0) {
            const triggersToInsert = triggersArray.map((t: any) => ({
                automation_id: params.id,
                trigger_type: t.type,
                trigger_filter: t.payload
            }));
            await supabase.from('automation_triggers').insert(triggersToInsert);
        }
    }

    // Also update parent automation updated_at
    await supabase.from('automations').update({ updated_at: new Date().toISOString() }).eq('id', params.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createClient();

    // Get Draft
    const { data: draft, error } = await supabase
        .from('automation_drafts')
        .select('*')
        .eq('automation_id', params.id)
        .single();

    // Get Triggers
    const { data: triggers } = await supabase
        .from('automation_triggers')
        .select('*')
        .eq('automation_id', params.id);

    if (error) {
        return NextResponse.json({ nodes: [], edges: [], triggers: [] });
    }

    // Map DB columns back to frontend expected structure
    const mappedTriggers = (triggers || []).map((t: any) => ({
        type: t.trigger_type,
        payload: t.trigger_filter
    }));

    return NextResponse.json({ ...draft, triggers: mappedTriggers });
}
