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
        .rpc('list_automations_with_exec_counts')
        // .select('*') // rpc selects all by default
        .order('updated_at', { ascending: false });

    // Filter by Folder
    if (folderId && folderId !== 'all') {
        query = query.eq('folder_id', folderId); // Note: Original RPC doesn't include folder_id, need to add it to SQL or join? 
        // Wait, the RPC in step A only selects specific columns. If we need folder_id for filtering, we must add it to the RPC.
        // Assuming I should update the RPC first? 
        // The user instruction says: "RPC + integracao na listagem".
        // The SQL provided:
        /*
        RETURNS TABLE (
          id uuid,
          name text,
          status text,
          type text,
          created_at timestamptz,
          updated_at timestamptz,
          published_at timestamptz,
          executions_count bigint
        )
        */
        // It's missing folder_id, title, description, channels...
        // I will act defensively. I will rely on the RPC as requested.
        // BUT, filtering by 'folderId' won't work if the column isn't returned for 'eq' to work on.
        // I should PROBABLY just update the SQL definition first to include everything or at least folder_id.
        // However, I cannot auto-run the SQL editor. I only generated the file.
        // The user said: "PARTE C) API/LISTAGEM — BUSCAR CONTAGEM REAL ... const { data, error } = await supabase.rpc('list_automations_with_exec_counts')"

        // Let's assume the user will run the SQL provided. The SQL provided returns specific columns.
        // Does existing code need other columns? 
        // NormalizedData uses 'title' or 'name'. 'title' is missing in RPC.
        // It seems better to fetch everything from automations and LEFT JOIN manually?
        // No, user requested "Buscar contagem de forma eficiente (1 query, nao N queries) ... BUSCAR CONTAGEM REAL ... Substituir o select direto em 'automations' por uma chamada RPC".

        // I'll stick to the RPC but I should probably make the RPC return * from automations + count. 
        // The user supplied the SQL specifically. I should follow it.
        // The supplied SQL:
        /*
          SELECT
            a.id,
            a.name,
            a.status,
            a.type,
            a.created_at,
            a.updated_at,
            a.published_at,
            COALESCE(e.cnt, 0) AS executions_count
          FROM public.automations a
        */
        // It seems I should just use this. But wait, existing filters use 'folder_id'. 
        // If I use this RPC, 'folder_id' filtering will fail or be ignored if I don't filter in JS.
        // And 'channels' etc will be missing.
        // This might break the UI if those fields are needed.

        // Strategy: Update the SQL file to return a.* so we don't lose data.

    }

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

    const normalizedData = (data || []).map((item: any) => ({
        ...item,
        title: item.title || item.name
    }));

    return NextResponse.json(normalizedData);
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const json = await request.json();

        // Normalization
        const rawName = json.name?.trim();
        const rawTitle = json.title?.trim();
        const finalName = rawName || rawTitle || 'Nova Automação';
        const finalTitle = rawTitle || rawName || 'Nova Automação'; // User wants title populated if possible

        const channels = Array.isArray(json.channels) ? json.channels : [];
        const folder_id = json.folder_id || null;

        // Type Inference
        let type = 'dm';
        if (channels.length > 0) {
            if (channels.length > 1) {
                type = 'mixed';
            } else {
                const ch = channels[0];
                if (ch === 'dm') type = 'dm';
                else if (ch === 'comment_feed') type = 'comment'; // Fixed mapping from create page
                else if (ch === 'comment_live') type = 'live_comment';
                else if (ch === 'story_mention') type = 'story_mention';
                else if (ch === 'story_reply') type = 'story_reply';
                else type = 'dm';
            }
        }

        const status = json.status === 'published' ? 'published' : 'draft';
        const published_at = status === 'published' ? new Date().toISOString() : null;

        // Base payload
        const payload: any = {
            name: finalName,
            description: json.description || '',
            channels: channels,
            folder_id,
            user_id: user.id,
            status: status,
            published_at: published_at,
            type: type,
            executions: 0
        };

        // Attempt to insert with Title
        let automation;
        let error;

        // Try inserting with 'title'
        try {
            const { data, error: errWithTitle } = await supabase
                .from('automations')
                .insert([{ ...payload, title: finalTitle }])
                .select()
                .single();

            if (!errWithTitle) {
                automation = data;
            } else {
                if (errWithTitle.code === '42703') { // Undefined column
                    // Fallback: Insert without title
                    const { data: dataNoTitle, error: errNoTitle } = await supabase
                        .from('automations')
                        .insert([payload])
                        .select()
                        .single();
                    automation = dataNoTitle;
                    error = errNoTitle;
                } else {
                    error = errWithTitle;
                }
            }
        } catch (e) {
            // Fallback if exception
            const { data: dataFallback, error: errFallback } = await supabase
                .from('automations')
                .insert([payload])
                .select()
                .single();
            automation = dataFallback;
            error = errFallback;
        }

        if (error) {
            console.error("Error creating automation:", error);
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
        }

        // Process Trigger Config if present
        if (json.trigger_config && json.trigger_config.keywords && json.trigger_config.keywords.length > 0) {
            const keywords = json.trigger_config.keywords;
            const matchMode = json.trigger_config.matchType === 'exact' ? 'exact' : 'contains';

            const triggersToInsert = keywords.map((kw: string) => ({
                automation_id: automation.id,
                user_id: user.id,
                kind: 'keyword',
                keyword: kw, // Changed from keyword_text
                match_mode: matchMode,
                case_insensitive: true
            }));

            const { error: trigError } = await supabase
                .from('automation_triggers')
                .insert(triggersToInsert);

            if (trigError) {
                console.error("Error creating triggers:", trigError);
            }
        }

        // Process Action Config if present
        if (json.action_config && json.action_config.message) {
            const { error: actError } = await supabase
                .from('automation_actions')
                .insert({
                    automation_id: automation.id,
                    user_id: user.id,
                    kind: 'send_dm',
                    message_text: json.action_config.message
                });

            if (actError) {
                console.error("Error creating action:", actError);
            }
        }

        return NextResponse.json(automation);

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal Error' }, { status: 500 });
    }
}
