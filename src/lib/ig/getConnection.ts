
import { createClient } from '@/lib/supabase/server'

export async function getIGConnection() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return null
    }

    const { data, error } = await supabase
        .from('ig_connections')
        .select('*')
        .eq('user_id', user.id)
        .single()

    if (error || !data) {
        return null
    }

    return data
}
