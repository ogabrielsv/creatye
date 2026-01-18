import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const folderId = searchParams.get('folder_id');
    const status = searchParams.get('status'); // all | published | draft
    const q = searchParams.get('q');

    let query = supabase
        .from('automations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

    // Filter by Folder
    if (folderId && folderId !== 'all') {
        query = query.eq('folder_id', folderId);
    }

    // Filter by Status
    if (status === 'published') {
        query = query.eq('status', 'published');
    } else if (status === 'draft') {
        query = query.eq('status', 'draft');
    }
    // if status === 'all' or undefined, return all (default behavior of no filter)

    // Filter by Name (Search)
    if (q) {
        query = query.ilike('name', `%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const json = await request.json();

        const name = json.name ? json.name.trim() : 'Nova Automação';
        const channels = json.channels || [];
        const folder_id = json.folder_id || null;

        // We do NOT enforce IG connection here to allow exploring the builder, 
        // unless channels explicitly require it. But for a "Draft", it's usually fine.
        // User requested: "Criar no Supabase via POST /api/automations com status draft."

        // Determine type from channels
        let type = 'dm';
        if (channels && channels.length > 0) {
            const ch = channels[0];
            if (channels.length > 1) type = 'mixed';
            else if (ch === 'dm') type = 'dm';
            else if (ch === 'feed_comment') type = 'comment';
            else if (ch === 'live_comment') type = 'live_comment';
            else if (ch === 'story_mention') type = 'story_mention';
            else if (ch === 'story_reply') type = 'story_reply';
            else type = 'dm'; // fallback
        }

        // Create Automation (Status Draft)
        const { data: automation, error } = await supabase
            .from('automations')
            .insert([{
                name,
                description: json.description || '',
                channels: channels,
                folder_id,
                user_id: user.id,
                status: 'draft',
                type: type, // Explicitly set type
                executions: 0
            }])
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Create Initial Draft with Start Node
        const startNode = {
            id: 'start-1',
            type: 'start',
            position: { x: 100, y: 100 },
            data: {
                label: 'Início',
                triggers: [],
                channels: []
            }
        };

        const { error: draftError } = await supabase
            .from('automation_drafts')
            .insert({
                automation_id: automation.id,
                user_id: user.id,
                nodes: [startNode],
                edges: [],
                updated_at: new Date().toISOString()
            });

        if (draftError) {
            console.error("Error creating draft details:", draftError);
            // Non-fatal? Maybe, but UI expects it.
        }

        return NextResponse.json(automation);

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal Error' }, { status: 500 });
    }
}
