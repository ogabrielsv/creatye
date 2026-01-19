import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
    const url =
        process.env.SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL

    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE ||
        process.env.SUPABASE_KEY

    if (!url) throw new Error('supabaseUrl is required')
    if (!key) throw new Error('supabaseKey is required')

    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
}
