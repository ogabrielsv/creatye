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

        // FIX 23502: ig_user_id cannot be null.
        // It generally represents the Fan/Sender.
        const igUserId = sender_id || raw_event?.sender?.id || raw_event?.messaging?.[0]?.sender?.id || "unknown_sender";

        const dbPayload = {
            automation_id,
            user_id,
            status,
            version_id: version_id || null,
            error: error_message || null,
            ig_user_id: igUserId,
            payload: {
                message_text,
                channel,
                raw_event,
                ...(extra_payload || {})
            }
        };

        const { error } = await supabaseAdmin.from('automation_executions').insert(dbPayload);

        if (error) {
            console.error("[EXEC_LOG] Insert failed DB Error:", JSON.stringify(error));
        }
    } catch (err) {
        console.error("[EXEC_LOG] Insert failed Exception:", err);
    }
}

// 1. Helper Account Resolution (The Source of Truth)
async function resolveAccountByRecipientId(recipientId: string) {
    // 1. Try instagram_accounts (Standard)
    const { data: acc } = await supabaseAdmin
        .from('instagram_accounts')
        .select('*')
        .eq('ig_user_id', recipientId) // Match by Instagram Business ID (recipient)
        .is('disconnected_at', null)
        .maybeSingle();

    if (acc) {
        if (!acc.page_access_token) {
            console.log(`[RESOLVE_ACCOUNT] Account found for ${recipientId} but page_access_token is missing.`);
            return null;
        }

        return {
            userId: acc.user_id,
            accessToken: acc.page_access_token, // Use Page Token for Graph API
            igUserId: acc.ig_user_id,
            source: 'instagram_accounts',
            dbId: acc.id
        };
    }

    // 2. Fallback: Try matching by page_id if recipient is actually page_id (edge case)
    const { data: pageAcc } = await supabaseAdmin
        .from('instagram_accounts')
        .select('*')
        .eq('page_id', recipientId)
        .is('disconnected_at', null)
        .maybeSingle();

    if (pageAcc && pageAcc.page_access_token) {
        return {
            userId: pageAcc.user_id,
            accessToken: pageAcc.page_access_token,
            igUserId: pageAcc.ig_user_id,
            source: 'instagram_accounts_page_match',
            dbId: pageAcc.id
        };
    }

    return null;
}

export async function processIncomingMessage(params: IncomingMessage) {
    const { senderId, recipientId, text, timestamp, rawEvent } = params;

    const isStoryReply = Boolean(rawEvent?.message?.reply_to?.story);
    const eventChannel = isStoryReply ? 'story_reply' : 'dm';

    console.log(`[DM_EVENT] Processing from=${senderId} to_recipient=${recipientId} Channel=${eventChannel} Text="${text}"`);

    // A) Identificar conta
    const account = await resolveAccountByRecipientId(recipientId);

    if (!account) {
        console.log(`[DM_EVENT] NO_ACCOUNT_MAPPING recipientId=${recipientId}`);
        // Cannot proceed correctly without a user mapping
        return;
    }

    const { userId, accessToken, source, dbId } = account;
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

    // Quick match
    for (const auto of (automations || [])) {
        const trigNorm = (auto.trigger || "").trim().toLowerCase();
        if (!trigNorm) continue;

        const matchMode = auto.meta?.match_mode || 'contains';
        let isMatch = false;

        if (matchMode === 'equals' || matchMode === 'exact') isMatch = cleanText === trigNorm;
        else isMatch = cleanText.includes(trigNorm);

        if (isMatch) {
            matchedAuto = auto;
            matchedTriggerInfo = trigNorm;
            break;
        }
    }

    if (!matchedAuto) {
        console.log(`[DM_EVENT] [NO_MATCH] User=${userId} Text="${cleanText}"`);
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
        finalStatus = 'failed';
        errorMessage = 'No actions defined';
    } else {
        // Execute Loop
        try {
            // 1. Validate Token basic format
            if (!accessToken || accessToken.length < 5) {
                throw new Error('Missing or empty IG access token.');
            }
            console.log(`[AUTOMATION_RUN] Using token prefix=${accessToken.substring(0, 6)}... length=${accessToken.length}`);

            console.log(`[AUTOMATION_RUN] Executing ${actions.length} actions for ${matchedAuto.id}`);

            for (const act of actions) {
                let igApiError = null;

                if (act.kind === 'send_dm') {
                    try {
                        await sendInstagramDM(accessToken, senderId, act.message_text);
                    } catch (err: any) {
                        igApiError = err;
                    }
                } else if (act.kind === 'buttons' || act.kind === 'cards') {
                    // Build Payload Logic (Truncated for brevity, assuming standard structure)
                    let content = null;
                    if (act.kind === 'buttons') {
                        const buttons = (act.metadata?.buttons || []).slice(0, 3).map((b: any) =>
                            (b.type === 'link' ? { type: 'web_url', url: b.url, title: b.label } : { type: 'postback', title: b.label, payload: 'NEXT' })
                        );
                        content = { attachment: { type: "template", payload: { template_type: "button", text: act.message_text || "Opções", buttons } } };
                    }
                    // ... Cards similar ...
                    if (act.kind === 'cards') {
                        // Simple generic template usage
                        const elements = (act.metadata?.cards || []).slice(0, 10).map((c: any) => ({
                            title: c.title, subtitle: c.description, image_url: c.image,
                            buttons: (c.buttons || []).slice(0, 3).map((b: any) => (b.type === 'link' ? { type: 'web_url', url: b.url, title: b.label } : { type: 'postback', title: b.label, payload: 'N' }))
                        }));
                        content = { attachment: { type: "template", payload: { template_type: "generic", elements } } };
                    }

                    if (content) {
                        try {
                            await sendInstagramDM(accessToken, senderId, content);
                        } catch (err: any) {
                            igApiError = err;
                        }
                    }
                } else if (act.kind === 'delay') {
                    const ms = (act.metadata?.seconds || 1) * 1000;
                    await new Promise(r => setTimeout(r, ms));
                }

                if (igApiError) {
                    // Check for Error 190 (OAuthException)
                    const errStr = JSON.stringify(igApiError);
                    if (errStr.includes('"code":190') || errStr.includes('OAuthException') || errStr.includes('Validate access token')) {
                        console.error(`[EXEC_ERROR] Invalid Token (190) detected for account ${dbId}`);

                        // Mark token as invalid in DB if possible (Optional but requested)
                        if (source === 'instagram_accounts' && dbId) {
                            await supabaseAdmin.from('instagram_accounts').update({
                                // maybe set status or note
                                updated_at: new Date().toISOString()
                            }).eq('id', dbId);
                        }

                        throw new Error('Missing/invalid IG access token. Reconnect Instagram account.');
                    } else {
                        throw igApiError; // Rethrow other errors
                    }
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
        sender_id: senderId,
        raw_event: rawEvent,
        extra_payload: {
            matched_trigger: matchedTriggerInfo,
            match_channel: eventChannel,
            token_used: accessToken ? (accessToken.substring(0, 5) + '...') : 'none'
        }
    });
}
