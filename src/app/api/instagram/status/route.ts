import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ connected: false }, { status: 401 })
    }

    // Fetch from instagram_accounts
    const { data: account } = await supabase
        .from('instagram_accounts')
        .select('id, ig_username, ig_user_id, page_id, page_access_token, disconnected_at')
        .eq('user_id', user.id)
        .single()

    if (!account) {
        return NextResponse.json({ connected: false })
    }

    const isConnected = !!(account.page_access_token && !account.disconnected_at);

    return NextResponse.json({
        connected: isConnected,
        ig_username: account.ig_username,
        ig_user_id: account.ig_user_id,
        page_id: account.page_id
    })
}
