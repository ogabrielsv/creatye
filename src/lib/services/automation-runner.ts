import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendInstagramDM } from '@/lib/instagram/messenger';

interface IncomingMessage {
    platform: "instagram";
    channel: "dm";
    senderId: string;
    recipientId: string;
    text: string;
    timestamp: number;
    rawEvent: any;
}

// 0. Helper: Safe Insert Execution Log
// Prevents the webhook from crashing even if logging fails (e.g. 23502, connection error)
async function safeInsertExecLog(data: {
    user_id: string;
    automation_id: string;
    status: 'success' | 'failed' | 'running';
    message_text?: string;
    channel?: string;
    raw_event?: any;
    error_message?: string;
    version_id?: string;
    extra_payload?: any;
}) {
    try {
        const { user_id, automation_id, status, error_message, raw_event, message_text, channel, version_id, extra_payload } = data;

        // Construct the insert payload matching the schema
        const dbPayload = {
            automation_id,
            user_id,
            status, // 'running', 'success', 'failed'
            version_id: version_id || null,
            error: error_message || null,
            payload: {
                message_text,
                channel,
                raw_event, // Store the full event for debugging
                ...(extra_payload || {})
            }
        };

        const { error } = await supabaseAdmin.from('automation_executions').insert(dbPayload);

        if (error) {
            console.error("[EXEC_LOG] Insert failed DB Error:", error);
        }
    } catch (err) {
        // SWALLOW ERROR to protect the flow
        console.error("[EXEC_LOG] Insert failed Exception:", err);
    }
}

// 1. Helper Account Resolution
async function resolveAccountByRecipientId(recipientId: string) {
    // 1. Try instagram_accounts (Preferred/New Standard)
    const { data: acc } = await supabaseAdmin
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
    const { data: conn } = await supabaseAdmin
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
    const { senderId, recipientId, text, timestamp, rawEvent } = params;

    // 1. Detect Event Channel properly
    // If it has reply_to.story, it's a story_reply. Otherwise, it's a dm.
    const isStoryReply = Boolean(rawEvent?.message?.reply_to?.story);
    const eventChannel = isStoryReply ? 'story_reply' : 'dm';

    console.log(`[DM_EVENT] Processing from=${senderId} to_recipient=${recipientId} Channel=${eventChannel} RawText="${text}"`);

    // A) Identificar conta (Lookup Robust)
    const account = await resolveAccountByRecipientId(recipientId);

    if (!account) {
        console.log(`[DM_EVENT] NO_ACCOUNT_MAPPING recipientId=${recipientId} (not found in DB)`);
        return;
    }

    const { userId, accessToken } = account;
    console.log(`[DM_EVENT] Mapped to user_id=${userId} (via ${account.source})`);

    // B) Buscar automações (Supabase Admin)
    const cleanText = (text || "").trim().toLowerCase();

    // Use .or() syntax for the channel check: channel == eventChannel OR channels contains [eventChannel]
    const channelFilter = `channel.eq.${eventChannel},channels.cs.["${eventChannel}"]`;

    // Fetch automations
    const { data: automations, error: autoErr } = await supabaseAdmin
        .from('automations')
        .select('id, user_id, status, is_active, trigger_type, trigger, channel, channels, published_version_id, meta')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('status', 'published')
        .is('deleted_at', null)
        .eq('trigger_type', 'dm_keyword')
        .or(channelFilter)
        .order('updated_at', { ascending: false });

    if (autoErr) {
        console.error('[DM_EVENT] Error fetching automations:', autoErr);
        return;
    }

    const fetchedCount = automations?.length || 0;
    console.log(`[DM_EVENT] Fetched ${fetchedCount} candidates for Channel=${eventChannel} TextNorm="${cleanText}"`);

    // C) Matching Logic (Robust)
    let matchedAuto: any = null;
    let matchedTriggerInfo = "";

    const candidatesLog: string[] = [];
    const candidates = automations || [];

    for (const auto of candidates) {
        // Normalizar trigger do banco
        const trigNorm = (auto.trigger || "").trim().toLowerCase();

        // Match Mode
        const matchMode = auto.meta?.match_mode || auto.meta?.correspondencia || 'contains';

        // Debug info
        candidatesLog.push(`[id=${auto.id} trig="${trigNorm}" mode=${matchMode} ch_col=${auto.channel} channels=${JSON.stringify(auto.channels)}]`);

        // Ignorar trigger vazio
        if (!trigNorm) continue;

        let isMatch = false;

        if (matchMode === 'equals' || matchMode === 'exact') {
            isMatch = cleanText === trigNorm;
        } else {
            // Default: contains
            isMatch = cleanText.includes(trigNorm);
        }

        if (isMatch) {
            matchedAuto = auto;
            matchedTriggerInfo = trigNorm;
            break; // Stop at first match
        }
    }

    if (!matchedAuto) {
        // Log Detailed Failure before returning
        console.log(`[DM_EVENT] [NO_MATCH] Channel=${eventChannel} Text="${cleanText}" User=${userId}`);
        console.log(`[DM_EVENT] Candidates checked: ${candidatesLog.slice(0, 20).join(', ')}`);

        if (candidatesLog.length === 0) {
            const { count } = await supabaseAdmin
                .from('automations')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('status', 'published')
                .eq('is_active', true);
            console.log(`[DIAGNOSTIC] Total active/published automations for user (ignoring channel filters): ${count}`);
        }

        return;
    }

    console.log(`[DM_EVENT] [MATCH] Found! AutomationId=${matchedAuto.id} Trigger="${matchedTriggerInfo}" Channel=${eventChannel}`);

    // D) Executar Ações
    // Fetch actions
    const { data: actions } = await supabaseAdmin
        .from('automation_actions')
        .select('*')
        .eq('automation_id', matchedAuto.id)
        .order('created_at', { ascending: true });

    let finalStatus: 'success' | 'failed' = 'success';
    let errorMessage = '';

    if (!actions || actions.length === 0) {
        console.log(`[AUTOMATION_RUN] No actions definition found for ${matchedAuto.id}`);
        finalStatus = 'failed';
        errorMessage = 'No actions defined';
    } else {
        // Execute Loop
        try {
            console.log(`[AUTOMATION_RUN] Executing ${actions.length} actions for ${matchedAuto.id}`);

            for (const act of actions) {
                if (act.kind === 'send_dm') {
                    await sendInstagramDM(accessToken, senderId, act.message_text);
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
                        await sendInstagramDM(accessToken, senderId, content);
                    }
                } else if (act.kind === 'delay') {
                    const ms = (act.metadata?.seconds || 1) * 1000;
                    await new Promise(r => setTimeout(r, ms));
                }
            }
            console.log(`[AUTOMATION_RUN] Actions executed successfully.`);

        } catch (err: any) {
            console.error(`[EXEC_ERROR] Action failed: ${err.message}`);
            finalStatus = 'failed';
            errorMessage = err.message;
        }
    }

    // E) Salvar Log (Safe Insert)
    await safeInsertExecLog({
        user_id: userId,
        automation_id: matchedAuto.id,
        status: finalStatus,
        error_message: errorMessage,
        version_id: matchedAuto.published_version_id,
        channel: eventChannel,
        message_text: text,
        raw_event: rawEvent,
        extra_payload: {
            sender: senderId,
            matched_trigger: matchedTriggerInfo,
            match_channel: eventChannel
        }
    });
}
