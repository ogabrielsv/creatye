import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
    })
}
