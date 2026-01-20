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

// 0. Helper resolveAccount (Task 4.1)
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

    console.log(`[DM_EVENT] Processing from=${senderId} to_recipient=${recipientId}: "${text}"`);

    // A) Identificar conta (Lookup Robust)
    const account = await resolveAccountByRecipientId(recipientId);

    if (!account) {
        // Task 4.1: Log NO_ACCOUNT_MAPPING and return 200 (void)
        console.log(`[DM_EVENT] NO_ACCOUNT_MAPPING recipientId=${recipientId} (not found in DB)`);
        return;
    }

    const { userId, accessToken } = account;
    console.log(`[DM_EVENT] Mapped to user_id=${userId} (via ${account.source})`);

    // B) Buscar automações (Task 4.3 & 3.1)
    const eventIsStoryReply = Boolean(rawEvent?.message?.reply_to?.story);
    const allowedChannels = eventIsStoryReply ? ['dm', 'story_reply'] : ['dm'];

    // Normalize text for matching
    const cleanText = text.trim().toLowerCase();

    // Query Automations using supabaseAdmin
    const { data: automations, error: autoErr } = await supabaseAdmin
        .from('automations')
        .select('id, user_id, status, is_active, trigger_type, trigger, channel, published_version_id, meta')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('status', 'published')
        .is('deleted_at', null)
        .eq('trigger_type', 'dm_keyword')
        .in('channel', allowedChannels)
        .order('updated_at', { ascending: false });

    if (autoErr) {
        console.error('[DM_EVENT] Error fetching automations:', autoErr);
        return;
    }

    if (!automations || automations.length === 0) {
        // 3.5 Log Detailed Failure
        console.log(`[DM_EVENT] No active DM automations for user ${userId}. AllowedChannels=${JSON.stringify(allowedChannels)} Text="${cleanText}"`);

        // Diagnostic query
        const { count } = await supabaseAdmin
            .from('automations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        console.log(`[DIAGNOSTIC] Total automations for user ${userId} (ignoring filters): ${count}`);

        // Detailed diagnostic of first 10
        const { data: diagAutos } = await supabaseAdmin
            .from('automations')
            .select('id, status, is_active, trigger_type, channel, trigger')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(10);
        console.log('[DIAGNOSTIC] Recent automations:', JSON.stringify(diagAutos));

        return;
    }

    // C) Matching Logic (3.3)
    let matchedAuto: any = null;
    let matchedTrigger = '';

    console.log(`[AUTOMATION_MATCH] Checking ${automations.length} potential automations...`);

    for (const auto of automations) {
        // trigger field in 'automations' table usually holds the keyword directly for simple automations
        // or we use 'trigger' column. The logic says "Normalizar trigger do banco: trigNorm = (trigger ?? '').trim().toLowerCase()"

        // Check match_mode from meta or assume contains
        // The user mentioned "Se automations tiverem campo 'match_mode' / 'correspondencia'". 
        // Assuming this is in `meta` or passed somehow. The table schema implies `trigger` column holds the keyword?
        // Let's assume `trigger` is the keyword string, and `meta.match_mode` might exist.

        const triggerKeyword = (auto.trigger || '').trim().toLowerCase();
        if (!triggerKeyword) continue;

        const matchMode = auto.meta?.match_mode || 'contains'; // default contains

        let isMatch = false;
        if (matchMode === 'equals') {
            isMatch = cleanText === triggerKeyword;
        } else {
            // contains
            isMatch = cleanText.includes(triggerKeyword);
        }

        if (isMatch) {
            matchedAuto = auto;
            matchedTrigger = triggerKeyword;
            break;
        }
    }

    if (!matchedAuto) {
        console.log(`[DM_EVENT] [NO_MATCH] Text="${cleanText}" User=${userId} ValidCandidates=${automations.length}`);
        return;
    }

    // 3.4 Log Success
    console.log(`[DM_EVENT] Found Match! automationId=${matchedAuto.id} trigger="${matchedTrigger}" channel=${matchedAuto.channel}`);

    // D) Execução
    const { data: exec, error: execErr } = await supabaseAdmin.from('automation_executions').insert({
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

    // Fetch Actions
    const { data: actions } = await supabaseAdmin
        .from('automation_actions')
        .select('*')
        .eq('automation_id', matchedAuto.id)
        .order('created_at', { ascending: true });

    if (!actions || actions.length === 0) {
        console.log(`[AUTOMATION_RUN] No actions definition found for ${matchedAuto.id}`);
        await supabaseAdmin.from('automation_executions')
            .update({ status: 'success', error_message: 'No actions' })
            .eq('id', execId);
        return;
    }

    // Execute Loop
    try {
        console.log(`[AUTOMATION_RUN] Executing ${actions.length} actions for ${execId}`);
        for (const act of actions) {
            if (act.kind === 'send_dm') {
                await sendInstagramDM(accessToken, senderId, act.message_text); // senderId is the user to reply to
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

        // Success
        await supabaseAdmin.from('automation_executions').update({ status: 'success' }).eq('id', execId);
        console.log(`[AUTOMATION_RUN] Success ${execId}`);
    } catch (err: any) {
        console.error(`[EXEC_ERROR] ${err.message}`);
        await supabaseAdmin.from('automation_executions')
            .update({ status: 'failed', error_message: err.message })
            .eq('id', execId);
    }
}
