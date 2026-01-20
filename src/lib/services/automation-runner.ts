import { createAdminClient } from "@/lib/supabase/admin";

interface IncomingMessage {
    platform: "instagram";
    channel: "dm";
    senderId: string;
    recipientId: string;
    text: string;
    timestamp: number;
    rawEvent: any;
}

// 0. Helper resolveAccount (Task 4.1)
async function resolveAccountByRecipientId(supabase: any, recipientId: string) {
    // 1. Try instagram_accounts (Preferred/New Standard)
    const { data: acc } = await supabase
        .from('instagram_accounts')
        .select('*')
        .eq('instagram_id', recipientId)
        .maybeSingle();

    if (acc) {
        return {
            userId: acc.user_id,
            accessToken: acc.access_token,
            source: 'instagram_accounts'
        };
    }

    // 2. Fallback ig_connections (Legacy Support)
    // Checks multiple columns where ID might be stored
    const { data: conn } = await supabase
        .from('ig_connections')
        .select('*')
        .or(`instagram_business_account_id.eq.${recipientId},instagram_scoped_id.eq.${recipientId},ig_user_id.eq.${recipientId}`)
        .maybeSingle();

    if (conn) {
        return {
            userId: conn.user_id,
            accessToken: conn.access_token,
            source: 'ig_connections'
        };
    }

    return null;
}

export async function processIncomingMessage(params: IncomingMessage) {
    const { senderId, recipientId, text, timestamp } = params;
    const supabase = createAdminClient();

    console.log(`[DM_EVENT] Processing from=${senderId} to_recipient=${recipientId}: "${text}"`);

    // A) Identificar conta (Lookup Robust)
    const account = await resolveAccountByRecipientId(supabase, recipientId);

    if (!account) {
        // Task 2.3: Log NO_ACCOUNT_MAPPING and return 200 (void)
        console.log(`[DM_EVENT] NO_ACCOUNT_MAPPING recipientId=${recipientId} (not found in DB)`);
        return;
    }

    const { userId, accessToken } = account;
    console.log(`[DM_EVENT] Mapped to user_id=${userId} (via ${account.source})`);

    // B) Buscar automações (Task 4.3 & 3.1)
    // Filter by channel DM explicitly
    const { data: automations } = await supabase
        .from('automations')
        .select(`
            id, name, published_version_id,
            automation_triggers (
                id, trigger_type, trigger_filter,
                keyword, match_mode 
            )
        `)
        .eq('user_id', userId)
        .eq('status', 'published')
        .is('deleted_at', null)
        .or('channel.eq.dm,channel.is.null'); // DM channels (legacy might be null)

    if (!automations || automations.length === 0) {
        console.log(`[DM_EVENT] No active DM automations for user ${userId}`);
        return;
    }

    // C) Matching
    const cleanText = text.trim().toLowerCase();

    let matchedAuto: any = null;
    let matchedTrigger: any = null;

    console.log(`[AUTOMATION_MATCH] Checking ${automations.length} active automations...`);

    for (const auto of automations) {
        if (!auto.automation_triggers) continue;

        for (const trig of auto.automation_triggers) {
            const filter = trig.trigger_filter || {};
            const keyword = (filter.keyword || trig.keyword || '').toLowerCase().trim();
            const matchMode = (filter.match_mode || trig.match_mode || 'contains').toLowerCase();

            if (!keyword) continue;

            let isMatch = false;
            if (matchMode === 'exact' || matchMode === 'equals') {
                isMatch = cleanText === keyword;
            } else {
                // Contains
                isMatch = cleanText.includes(keyword);
            }

            if (isMatch) {
                matchedAuto = auto;
                matchedTrigger = trig;
                break;
            }
        }
        if (matchedAuto) break;
    }

    if (!matchedAuto) {
        console.log(`[DM_EVENT] [NO_MATCH] Text="${cleanText}" User=${userId}`);
        return;
    }

    console.log(`[AUTOMATION_MATCH] Found Match! automationId=${matchedAuto.id} trigger=${matchedTrigger.id}`);

    // D) Execução
    // 1. Log START (Task 4 - Logs & Exec)
    const { data: exec, error: execErr } = await supabase.from('automation_executions').insert({
        automation_id: matchedAuto.id,
        user_id: userId,
        version_id: matchedAuto.published_version_id,
        status: 'running',
        payload: {
            source: 'dm',
            input: text,
            sender: senderId,
            recipient_mapped: recipientId
        },
        updated_at: new Date().toISOString()
    }).select('id').single();

    if (execErr) {
        console.error('[EXEC_LOG] Insert failed:', execErr);
        return;
    }
    const execId = exec.id;

    // 2. Fetch Actions
    const { data: actions } = await supabase
        .from('automation_actions')
        .select('*')
        .eq('automation_id', matchedAuto.id)
        .order('created_at', { ascending: true });

    if (!actions || actions.length === 0) {
        console.log(`[AUTOMATION_RUN] No actions definition found for ${matchedAuto.id}`);
        await supabase.from('automation_executions')
            .update({ status: 'success', error_message: 'No actions' })
            .eq('id', execId);
        return;
    }

    // 3. Execute Loop
    try {
        console.log(`[AUTOMATION_RUN] Executing ${actions.length} actions for ${execId}`);
        for (const act of actions) {
            if (act.kind === 'send_dm') {
                await sendInstagramDM({
                    accessToken,
                    recipientId: senderId, // We reply TO the sender
                    text: act.message_text
                });
            } else if (act.kind === 'buttons' || act.kind === 'cards') {
                let content = null;
                if (act.kind === 'buttons') {
                    const buttons = (act.metadata?.buttons || []).slice(0, 3).map((b: any) =>
                        (b.type === 'link' ? { type: 'web_url', url: b.url, title: b.label } : { type: 'postback', title: b.label, payload: 'NEXT' })
                    );
                    content = { attachment: { type: "template", payload: { template_type: "button", text: act.message_text || "Opções", buttons } } };
                } else if (act.kind === 'cards') {
                    const elements = (act.metadata?.cards || []).slice(0, 10).map((c: any) => ({
                        title: c.title, subtitle: c.description, image_url: c.image,
                        buttons: (c.buttons || []).slice(0, 3).map((b: any) => (b.type === 'link' ? { type: 'web_url', url: b.url, title: b.label } : { type: 'postback', title: b.label, payload: 'N' }))
                    }));
                    content = { attachment: { type: "template", payload: { template_type: "generic", elements } } };
                }

                if (content) {
                    await sendInstagramDM({ accessToken, recipientId: senderId, content });
                }
            }
        }

        // Success
        await supabase.from('automation_executions').update({ status: 'success' }).eq('id', execId);
        console.log(`[AUTOMATION_RUN] Success ${execId}`);

    } catch (err: any) {
        console.error(`[EXEC_ERROR] ${err.message}`);
        await supabase.from('automation_executions')
            .update({ status: 'failed', error_message: err.message })
            .eq('id', execId);
    }
}

// 3) Funcao de Envio (SERVICE)
async function sendInstagramDM({ accessToken, recipientId, text, content }: { accessToken: string, recipientId: string, text?: string, content?: any }) {
    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`;

    let body: any = { recipient: { id: recipientId } };
    if (content) {
        body.message = content;
    } else {
        body.message = { text: text };
    }

    // Call Graph API
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const responseBody = await res.json();

    if (!res.ok) {
        console.error("[SEND_ERROR]", { status: res.status, body: responseBody });
        throw new Error(`Graph API Info: ${JSON.stringify(responseBody)}`);
    }

    console.log("[SEND] OK", { recipientId });
    return responseBody;
}
