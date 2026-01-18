import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const supabase = createClient();
    const searchParams = request.nextUrl.searchParams;
    const folderId = searchParams.get('folder_id');

    let query = supabase
        .from('automations')
        .select('*')
        .order('updated_at', { ascending: false });

    if (folderId) {
        // query = query.eq('folder_id', folderId);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
    const supabase = createClient();
    const json = await request.json();

    // Validation
    if (!json.name || !json.channels || json.channels.length === 0) {
        return NextResponse.json({ error: 'Name and channels are required' }, { status: 400 });
    }

    const name = json.name;
    const description = json.description || '';
    const channels = json.channels; // Array of strings
    const folder_id = json.folder_id || null;

    // Get user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FASE F3: API-side enforcement
    // Check if user has active Instagram connection
    const { data: connection } = await supabase
        .from('ig_connections')
        .select('access_token')
        .eq('user_id', user.id)
        .single();

    if (!connection) {
        return NextResponse.json({ error: 'Instagram connection required to create automations.' }, { status: 403 });
    }

    // Create Automation
    const { data: automation, error } = await supabase
        .from('automations')
        .insert([{
            name,
            description,
            channels,
            folder_id,
            // For now, storing extra data in type or skipping if column missing
            // Emulating type logic:
            type: channels.length > 1 ? 'mixed' : (channels[0].includes('dm') ? 'dm' : (channels[0].includes('story') ? 'story' : 'feed')),
            user_id: user.id,
            status: 'draft',
            executions: 0
        }])
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Determine Trigger Type based on Channels
    const triggers = channels.map((ch: string) => {
        const typeMap: any = {
            'dm': 'dm_received',
            'feed_comment': 'feed_comment_received',
            'live_comment': 'live_comment_received',
            'story_mention': 'story_mention_received',
            'story_reply': 'story_reply_received'
        };
        return typeMap[ch] || 'unknown';
    });

    const triggerConfig = json.trigger_config || {};

    // Create Initial Draft with Smart Start Node
    const startNode = {
        id: 'start-1',
        type: 'start',
        position: { x: 100, y: 100 },
        data: {
            label: 'Início',
            triggers: triggers,
            channels: channels,
            triggerConfig: triggerConfig // Persist config
        }
    };

    await supabase
        .from('automation_drafts')
        .insert({
            automation_id: automation.id,
            user_id: user.id,
            nodes: [startNode],
            edges: [], // Empty edges
            updated_at: new Date().toISOString()
        });

    return NextResponse.json(automation);
}
