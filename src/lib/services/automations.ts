import { SupabaseClient } from '@supabase/supabase-js';

export async function runAutomations(eventRow: any, supabase: SupabaseClient) {
    const payload = eventRow.payload;
    // Iterate over entries
    // Often: entry: [ { id: '...', time: ..., changes: [...] } ] or messaging [...]

    if (!payload.entry || !Array.isArray(payload.entry)) {
        console.warn('Invalid payload format', payload);
        return;
    }

    for (const entry of payload.entry) {
        // We might need to find which Instagram Account this entry belongs to (entry.id is usually the ig_user_id)
        const igUserId = entry.id;

        // Log "Seeing entry"
        await logAutomation(supabase, null, igUserId, 'info', 'Processing webhook entry', { entry_id: igUserId });

        // Find account (optional for now, but good practice)
        const { data: account } = await supabase
            .from('instagram_accounts')
            .select('user_id')
            .eq('ig_user_id', igUserId)
            .single();

        const userId = account?.user_id || null;

        // Process Messaging (DMs)
        if (entry.messaging) {
            for (const msgEvent of entry.messaging) {
                await processMessage(supabase, userId, igUserId, msgEvent);
            }
        }

        // Process Changes (Comments etc)
        if (entry.changes) {
            for (const change of entry.changes) {
                await processChange(supabase, userId, igUserId, change);
            }
        }
    }
}

async function processMessage(supabase: SupabaseClient, userId: string | null, igUserId: string, event: any) {
    // Log-only mode as requested
    const senderId = event.sender?.id;
    const text = event.message?.text || '[Non-text message]';

    await logAutomation(supabase, userId, igUserId, 'info', `New DM received from ${senderId}`, {
        text_snippet: text.substring(0, 50),
        sender_id: senderId
    });

    // Here we would look up automation rules...
}

async function processChange(supabase: SupabaseClient, userId: string | null, igUserId: string, change: any) {
    const field = change.field;
    const val = change.value;

    await logAutomation(supabase, userId, igUserId, 'info', `New Change Event: ${field}`, {
        field,
        value_snippet: JSON.stringify(val).substring(0, 50)
    });
}

export async function logAutomation(
    supabase: SupabaseClient,
    userId: string | null,
    igAccountId: string | null, // ig_user_id or uuid? Let's use string for versatility but DB expects uuid for FKs usually. 
    // Actually DB schema says instagram_account_id uuid. 
    // But here we might only have ig_user_id. 
    // Let's try to map it if possible or leave null.
    level: string,
    message: string,
    meta?: any
) {
    // If we have userId, we can try to look up account UUID if needed, but for logs, we might just store text in meta if FK fails?
    // The schema created: user_id uuid, instagram_account_id uuid.
    // If we don't have the UUIDs, we assume nullable.

    // We already tried to fetch userId in runAutomations.

    // Check if we can find account UUID
    let accountUuid = null;
    if (igAccountId) {
        const { data } = await supabase.from('instagram_accounts').select('id').eq('ig_user_id', igAccountId).single();
        if (data) accountUuid = data.id;
    }

    try {
        await supabase.from('automation_logs').insert({
            user_id: userId,
            instagram_account_id: accountUuid,
            level,
            message,
            meta: { ...meta, ig_user_id_raw: igAccountId },
            created_at: new Date().toISOString()
        });
    } catch (e) {
        console.error('[AUTOMATION LOG] Failed to write log', e);
    }
}
