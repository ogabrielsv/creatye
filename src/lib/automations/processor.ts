
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInstagramDM } from "@/lib/instagram/messenger";

export interface InstagramMessageEvent {
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
        mid: string;
        text: string;
    };
}

export async function processInstagramMessage(event: InstagramMessageEvent) {
    // 1. Validate Event
    if (!event.message || !event.message.text) {
        console.log('Skipping non-text message:', event);
        return;
    }

    const { text, mid } = event.message;
    const senderId = event.sender.id;
    const recipientId = event.recipient.id; // This matches ig_user_id

    const supabase = createAdminClient();

    // 2. Find the Connection (User who owns this Instagram Page)
    const { data: connection, error: connectionError } = await supabase
        .from('ig_connections')
        .select('*')
        .eq('ig_user_id', recipientId)
        .single();

    if (connectionError || !connection) {
        console.error('Connection not found for recipient:', recipientId, connectionError);
        return;
    }

    const userId = connection.user_id;

    // Refresh Token Logic
    // Refresh if within 2 days (172800000ms) or expired
    const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
    const now = Date.now();

    if (expiresAt && (expiresAt - now < 2 * 24 * 60 * 60 * 1000)) {
        try {
            // lazy import to avoid circle if any? strictly auth.ts is leaf
            const { refreshLongLivedToken } = await import('@/lib/instagram/auth');
            const refreshed = await refreshLongLivedToken(connection.access_token);

            const newExpiresAt = new Date(now + refreshed.expires_in * 1000).toISOString();

            // Update DB
            await supabase.from('ig_connections')
                .update({
                    access_token: refreshed.access_token,
                    token_expires_at: newExpiresAt,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            // Update local var
            connection.access_token = refreshed.access_token;
            console.log(`Refreshed token for user ${userId}`);
        } catch (e) {
            console.error('Token refresh failed:', e);
            // Proceed with old token, might still work
        }
    }

    // 3. Find Matches (Published Automations)
    // efficient query: filtering by user_id and status
    const { data: automations, error: automationsError } = await supabase
        .from('automations')
        .select(`
            id,
            name,
            automation_triggers (
                kind,
                keyword,
                match_mode,
                case_insensitive
            ),
            automation_actions (
                kind,
                message_text
            )
        `)
        .eq('user_id', userId)
        .eq('status', 'published');

    if (automationsError) {
        console.error('Error fetching automations:', automationsError);
        return;
    }

    if (!automations || automations.length === 0) {
        console.log('No published automations for user:', userId);
        return;
    }

    // 4. Evaluate Triggers
    const matchedAutomations = automations.filter((automation) => {
        // Evaluate triggers (OR logic - if any trigger matches, fire automation)
        // Adjust logic if you need AND. Usually triggers are entry points, so OR.
        const triggers = automation.automation_triggers;
        if (!triggers || triggers.length === 0) return false;

        return triggers.some((trigger: any) => {
            if (trigger.kind !== 'keyword') return false; // Only keyword supported for now

            const keyword = trigger.keyword || '';
            const content = text;

            let match = false;
            let triggerKeyword = keyword;
            let msgContent = content;

            if (trigger.case_insensitive) {
                triggerKeyword = triggerKeyword.toLowerCase();
                msgContent = msgContent.toLowerCase();
            }

            if (trigger.match_mode === 'exact') {
                match = msgContent.trim() === triggerKeyword.trim();
            } else if (trigger.match_mode === 'contains') {
                match = msgContent.includes(triggerKeyword);
            } else {
                // Default equals?
                match = msgContent.trim() === triggerKeyword.trim();
            }
            return match;
        });
    });

    if (matchedAutomations.length === 0) {
        console.log('No matching keywords found in message:', text);
        return;
    }

    console.log(`Found ${matchedAutomations.length} matching automations.`);

    // 5. Execute Actions
    for (const automation of matchedAutomations) {
        // Rate Limiting Check
        // Check for recent execution for this specific sender
        const { data: recentExec } = await supabase
            .from('automation_executions')
            .select('created_at')
            .eq('automation_id', automation.id)
            .contains('payload', { sender: { id: senderId } })
            .gt('created_at', new Date(Date.now() - 60 * 1000).toISOString()) // Last 60 seconds
            .limit(1);

        if (recentExec && recentExec.length > 0) {
            console.log(`Rate limit matched for automation ${automation.id} and sender ${senderId}`);
            continue;
        }

        // Log Start
        const { data: execution, error: execError } = await supabase
            .from('automation_executions')
            .insert({
                automation_id: automation.id,
                user_id: userId,
                status: 'running',
                payload: event
            })
            .select()
            .single();

        const executionId = execution?.id;

        try {
            const actions = automation.automation_actions;
            if (!actions) continue;

            for (const action of actions) {
                if (action.kind === 'send_dm') {
                    // Send DM
                    await sendInstagramDM(connection.access_token, senderId, action.message_text);
                    console.log(`Sent DM to ${senderId} for automation ${automation.id}`);
                }
            }

            // Update Execution Success
            if (executionId) {
                await supabase
                    .from('automation_executions')
                    .update({ status: 'success' })
                    .eq('id', executionId);
            }

        } catch (err: any) {
            console.error('Error executing automation:', automation.id, err);
            // Update Execution Failed
            if (executionId) {
                await supabase
                    .from('automation_executions')
                    .update({
                        status: 'failed',
                        error: err.message
                    })
                    .eq('id', executionId);
            }
        }
    }
}
