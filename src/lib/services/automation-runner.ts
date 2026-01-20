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
    sender_id?: string; // We map this to ig_user_id
    extra_payload?: any;
}) {
    try {
        const { user_id, automation_id, status, error_message, raw_event, message_text, channel, version_id, sender_id, extra_payload } = data;

        // Construct the insert payload matching the schema
        // automation_executions: id (default), automation_id, user_id, status, error, payload, created_at, VERSION_ID, IG_USER_ID
        // IMPORTANT: ig_user_id must be NOT NULL according to error 23502

        // Strategy: Use sender_id for ig_user_id. If missing, we MUST provide a fallback or ensure it's not null.
        // It seems the table schema demands `ig_user_id` (the person who triggered execution, aka Instagram User ID).
        const igUserId = sender_id || raw_event?.sender?.id || "unknown_sender";

        const dbPayload = {
            automation_id,
            user_id,
            status, // 'running', 'success', 'failed'
            version_id: version_id || null,
            error: error_message || null,
            ig_user_id: igUserId, // FIX FOR 23502
            payload: {
                message_text,
                channel,
                raw_event: raw_event, // Store the full event for debugging
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
        // Prioritize correct token: page_access_token (Graph API) > access_token (Legacy)
        const token = acc.page_access_token || acc.access_token;

        return {
            userId: acc.user_id,
            accessToken: token,
            igUserId: acc.instagram_id, // This is the business account ID usually
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
        const token = conn.access_token; // usually legacy
        return {
            userId: conn.user_id,
            accessToken: token,
            igUserId: conn.instagram_business_account_id || conn.ig_user_id,
            source: 'ig_connections'
        };
    }

    return null;
}

export async function processIncomingMessage(params: IncomingMessage) {
    const { senderId, recipientId, text, timestamp, rawEvent } = params;

    // 1. Detect Event Channel properly
    const isStoryReply = Boolean(rawEvent?.message?.reply_to?.story);
    const eventChannel = isStoryReply ? 'story_reply' : 'dm';

    console.log(`[DM_EVENT] Processing from=${senderId} to_recipient=${recipientId} Channel=${eventChannel} Text="${text}"`);

    // A) Identificar conta
    const account = await resolveAccountByRecipientId(recipientId);

    if (!account) {
        console.log(`[DM_EVENT] NO_ACCOUNT_MAPPING recipientId=${recipientId}`);
        return;
    }

    const { userId, accessToken, source } = account;
    console.log(`[DM_EVENT] Mapped to user_id=${userId} (via ${source})`);

    // B) Buscar automações
    const cleanText = (text || "").trim().toLowerCase();
    const channelFilter = `channel.eq.${eventChannel},channels.cs.["${eventChannel}"]`;

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

    // C) Matching Logic
    let matchedAuto: any = null;
    let matchedTriggerInfo = "";

    // Detailed logs for matching
    const candidatesLog: string[] = [];
    const candidates = automations || [];

    for (const auto of candidates) {
        const trigNorm = (auto.trigger || "").trim().toLowerCase();
        const matchMode = auto.meta?.match_mode || auto.meta?.correspondencia || 'contains';

        candidatesLog.push(`[id=${auto.id} trig="${trigNorm}" mode=${matchMode}]`);

        if (!trigNorm) continue;

        let isMatch = false;
        if (matchMode === 'equals' || matchMode === 'exact') {
            isMatch = cleanText === trigNorm;
        } else {
            isMatch = cleanText.includes(trigNorm);
        }

        if (isMatch) {
            matchedAuto = auto;
            matchedTriggerInfo = trigNorm;
            break;
        }
    }

    if (!matchedAuto) {
        console.log(`[DM_EVENT] [NO_MATCH] Text="${cleanText}" User=${userId}`);
        console.log(`[DM_EVENT] Candidates: ${candidatesLog.slice(0, 5).join(', ')}`);
        return;
    }

    console.log(`[DM_EVENT] [MATCH] Found! AutomationId=${matchedAuto.id} Trigger="${matchedTriggerInfo}"`);

    // D) Executar Ações
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
            // Token Validation Check
            if (!accessToken || accessToken.length < 15) {
                throw new Error('Missing/invalid IG access token. Reconnect Instagram account.');
            }
            console.log(`[AUTOMATION_RUN] Using token (len=${accessToken.length}): ${accessToken.substring(0, 6)}...`);

            console.log(`[AUTOMATION_RUN] Executing ${actions.length} actions for ${matchedAuto.id}`);

            for (const act of actions) {
                if (act.kind === 'send_dm') {
                    // Send DM using SenderID from the event
                    await sendInstagramDM(accessToken, senderId, act.message_text);
                } else if (act.kind === 'buttons' || act.kind === 'cards') {
                    // ... Buttons/Cards Logic ...
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
    // Pass senderId as sender_id to map to ig_user_id
    await safeInsertExecLog({
        user_id: userId,
        automation_id: matchedAuto.id,
        status: finalStatus,
        error_message: errorMessage,
        version_id: matchedAuto.published_version_id,
        channel: eventChannel,
        message_text: text,
        sender_id: senderId, // IMPORTANT for 23502 fix
        raw_event: rawEvent,
        extra_payload: {
            matched_trigger: matchedTriggerInfo,
            match_channel: eventChannel
        }
    });
}
