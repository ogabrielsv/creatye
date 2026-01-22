import { createClient } from '@supabase/supabase-js';

// Cache to avoid hitting DB on every request for the same container
let cachedColumns: Set<string> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

export async function getSafeConfigColumns(supabaseAdmin: ReturnType<typeof createClient>, tableName: string = 'instagram_accounts'): Promise<Set<string>> {
    const now = Date.now();
    if (cachedColumns && (now - lastFetchTime < CACHE_TTL_MS)) {
        return cachedColumns;
    }

    try {
        // Try to use the RPC we just created
        // @ts-ignore
        const { data, error } = await supabaseAdmin.rpc('get_table_columns', { target_table: tableName });

        if (error || !data || !Array.isArray(data)) {
            console.warn('[SafeColumns] RPC failed, using fallback list.', error);
            throw new Error('RPC unavailable');
        }

        const cols = new Set<string>(data as string[]);

        // Update cache
        cachedColumns = cols;
        lastFetchTime = now;

        return cols;

    } catch (e) {
        // Fallback to the strict known superset we enforced in migration
        return new Set([
            'id', 'user_id', 'ig_user_id', 'page_id', 'page_access_token', 'user_access_token',
            'ig_username', 'created_at', 'updated_at', 'disconnected_at', 'token_expires_at'
        ]);
    }
}
