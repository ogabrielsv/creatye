import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendInstagramDM } from '@/lib/instagram/messenger'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED')
            return new NextResponse(challenge, { status: 200 })
        } else {
            return new NextResponse('Forbidden', { status: 403 })
        }
    }

    return new NextResponse('Bad Request', { status: 400 })
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        console.log('WEBHOOK_RECEIVED:', JSON.stringify(body, null, 2))

        if (body.object === 'instagram') {
            const supabase = createAdminClient()
            for (const entry of body.entry) {
                // 1) Handle Messaging (DMs)
                if (entry.messaging) {
                    for (const event of entry.messaging) {
                        if (event.message && !event.message.is_echo) {
                            await handleMessageEvent(supabase, event)
                        }
                    }
                }
                // 2) Handle Changes (Comments)
                if (entry.changes) {
                    for (const change of entry.changes) {
                        if (change.field === 'comments' || change.field === 'feed') {
                            await handleCommentEvent(supabase, entry.id, change.value)
                        }
                    }
                }
            }
        }

        return new NextResponse('EVENT_RECEIVED', { status: 200 })
    } catch (err) {
        console.error('Webhook Error:', err)
        return new NextResponse('Server Error', { status: 500 })
    }
}

async function handleCommentEvent(supabase: any, accountId: string, val: any) {
    if (!val || !val.text || !val.from?.id) return;

    const messageText = val.text;
    const senderId = val.from.id; // User who commented

    console.log(`[WEBHOOK] Comment received: "${messageText}" from ${senderId} on acct ${accountId}`);

    // 1. Get Access Token for this Account
    const { data: connection } = await supabase
        .from('ig_connections')
        .select('*')
        .eq('instagram_business_account_id', accountId)
        .maybeSingle();

    if (!connection) {
        console.log(`[WEBHOOK] No connection found for account ${accountId}`);
        return;
    }

    const accessToken = connection.access_token;
    const userId = connection.user_id;

    // 2. Find matching automation (Trigger Type = 'comment_keyword')
    const cleanText = messageText.trim().toLowerCase();

    // Using the 'automations' table and 'trigger_type' column
    const { data: automations, error: autoError } = await supabase
        .from('automations')
        .select(`
            id, 
            name, 
            trigger, 
            trigger_type
        `)
        .eq('user_id', userId)
        .eq('status', 'published')
        .is('deleted_at', null)
        .eq('trigger_type', 'comment_keyword') // IMPORTANT: Filter by comment type only

    if (autoError) {
        console.error('[WEBHOOK] Error fetching automations for comment:', autoError);
        return;
    }

    if (!automations || automations.length === 0) return;

    // Filter in memory for robust matching
    const matchedAuto = automations.find((a: any) => {
        const t = (a.trigger || '').toLowerCase();
        return cleanText.includes(t);
    });

    if (!matchedAuto) return;

    console.log(`[WEBHOOK] Matched Comment Custom Auto: ${matchedAuto.id}`);

    // 3. Fetch Actions
    const { data: actions } = await supabase
        .from('automation_actions')
        .select('*')
        .eq('automation_id', matchedAuto.id)
        .order('created_at', { ascending: true });

    if (!actions || actions.length === 0) return;

    const action = actions[0];

    // Log Execution
    let execId = null;
    const { data: exec } = await supabase.from('automation_executions').insert({
        automation_id: matchedAuto.id,
        user_id: userId,
        status: 'running',
        payload: { source: 'comment', text: messageText, sender_id: senderId },
        updated_at: new Date().toISOString()
    }).select('id').maybeSingle();
    if (exec) execId = exec.id;

    try {
        let content = null;
        if (action.kind === 'send_dm') content = action.message_text;
        else if (action.kind === 'buttons') {
            const buttons = (action.metadata?.buttons || []).slice(0, 3).map((b: any) => {
                if (b.type === 'link') return { type: 'web_url', url: b.url, title: b.label };
                return { type: 'postback', title: b.label, payload: 'NEXT_STEP' };
            });
            content = {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: action.message_text || "Escolha uma opção:",
                        buttons: buttons
                    }
                }
            };
        }
        else if (action.kind === 'cards') {
            const cards = action.metadata?.cards || [];
            if (cards.length > 0) {
                const elements = cards.slice(0, 10).map((c: any) => ({
                    title: c.title || 'Sem título',
                    subtitle: c.description || '',
                    image_url: c.image || undefined,
                    buttons: (c.buttons || []).slice(0, 3).map((b: any) => {
                        if (b.type === 'link') return { type: 'web_url', url: b.url, title: b.label };
                        return { type: 'postback', title: b.label, payload: 'NEXT_STEP' };
                    })
                }));
                content = {
                    attachment: {
                        type: "template",
                        payload: {
                            template_type: "generic",
                            elements: elements
                        }
                    }
                };
            }
        }

        if (content) {
            await sendInstagramDM(accessToken, senderId, content);
            if (execId) await supabase.from('automation_executions').update({ status: 'success' }).eq('id', execId);
            console.log('[WEBHOOK] Comment Reply DM Sent OK');
        }
    } catch (err: any) {
        console.error('[WEBHOOK] Comment Reply Error:', err);
        if (execId) await supabase.from('automation_executions').update({ status: 'failed', error: err.message }).eq('id', execId);
    }
}

async function handleMessageEvent(supabase: any, event: any) {
    const senderId = event.sender?.id
    const recipientId = event.recipient?.id
    const messageText = event.message?.text

    if (!senderId || !recipientId || !messageText) return

    console.log('[DM] sender:', senderId, 'recipient:', recipientId, 'text:', messageText)

    // 1) Find connection (Robust Strategy)
    let connection = null
    let { data: connScoped } = await supabase.from('ig_connections').select('*').eq('instagram_scoped_id', recipientId).maybeSingle()

    if (connScoped) {
        connection = connScoped
    } else {
        let { data: connLegacy } = await supabase.from('ig_connections').select('*').eq('ig_user_id', recipientId).maybeSingle()
        if (connLegacy) {
            connection = connLegacy
            await supabase.from('ig_connections').update({ instagram_scoped_id: recipientId }).eq('id', connection.id)
        } else {
            // Auto-link heuristic
            const { data: latest } = await supabase.from('ig_connections').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle()
            if (latest) {
                await supabase.from('ig_connections').update({ instagram_scoped_id: recipientId }).eq('id', latest.id)
                connection = { ...latest, instagram_scoped_id: recipientId }
            }
        }
    }

    if (!connection) {
        console.log('CONNECTION_NOT_FOUND for recipient:', recipientId)
        return
    }

    const userId = connection.user_id
    const accessToken = connection.access_token

    // 2) Fetch Automations (Type = 'dm_keyword' OR default null/keyword)
    // We want to avoid 'comment_keyword' types triggering on DM
    const { data: automations } = await supabase
        .from('automations')
        .select('id, name, status, trigger, trigger_type, user_id')
        .eq('user_id', userId)
        .eq('status', 'published')
        .is('deleted_at', null)
        // trigger_type should be null OR 'keyword' OR 'dm_keyword'. NOT 'comment_keyword'
        .neq('trigger_type', 'comment_keyword')

    if (!automations || automations.length === 0) return

    const normalizedMsg = messageText.trim().toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ')

    // 3) Iterate Automations
    for (const auto of automations) {
        const triggerKeyword = (auto.trigger || '').toLowerCase();
        if (!triggerKeyword) continue;

        // Default 'contains' logic
        if (normalizedMsg.includes(triggerKeyword)) {
            console.log(`MATCHED_DM_AUTOMATION: ${auto.id} (${auto.name})`)

            // Fetch Actions
            const { data: actions } = await supabase
                .from('automation_actions')
                .select('*')
                .eq('automation_id', auto.id)
                .order('created_at', { ascending: true })

            if (!actions || actions.length === 0) continue

            const action = actions[0];

            let execId: string | null = null
            const { data: exec } = await supabase
                .from('automation_executions')
                .insert({
                    automation_id: auto.id,
                    user_id: userId,
                    status: 'running',
                    payload: { sender_id: senderId, recipient_id: recipientId, message: messageText },
                    updated_at: new Date().toISOString()
                })
                .select('id')
                .maybeSingle()

            if (exec?.id) execId = exec.id

            console.log(`EXECUTING ACTION: ${action.kind} (ID: ${action.id})`)

            try {
                let content = null;
                if (action.kind === 'send_dm') content = action.message_text;
                else if (action.kind === 'buttons') { // Button Template matching
                    const buttons = (action.metadata?.buttons || []).slice(0, 3).map((b: any) => {
                        if (b.type === 'link') return { type: 'web_url', url: b.url, title: b.label };
                        return { type: 'postback', title: b.label, payload: 'NEXT_STEP' };
                    });
                    content = {
                        attachment: {
                            type: "template",
                            payload: {
                                template_type: "button",
                                text: action.message_text || "Escolha:",
                                buttons: buttons
                            }
                        }
                    };
                } else if (action.kind === 'cards') { // Cards Template matching
                    const cards = action.metadata?.cards || [];
                    if (cards.length > 0) {
                        const elements = cards.slice(0, 10).map((c: any) => ({
                            title: c.title || 'Sem título',
                            subtitle: c.description || '',
                            image_url: c.image || undefined,
                            buttons: (c.buttons || []).slice(0, 3).map((b: any) => {
                                if (b.type === 'link') return { type: 'web_url', url: b.url, title: b.label };
                                return { type: 'postback', title: b.label, payload: 'NEXT_STEP' };
                            })
                        }));
                        content = {
                            attachment: {
                                type: "template",
                                payload: {
                                    template_type: "generic",
                                    elements: elements
                                }
                            }
                        };
                    }
                }

                if (content) {
                    await sendInstagramDM(accessToken, senderId, content);
                    if (execId) await supabase.from('automation_executions').update({ status: 'success' }).eq('id', execId);
                    console.log('Action Sent OK match');
                }
            } catch (err: any) {
                console.error('ACTION_ERROR:', err)
                if (execId) await supabase.from('automation_executions').update({ status: 'failed', error: err.message }).eq('id', execId);
            }
            break; // Stop after first match
        }
    }
}
