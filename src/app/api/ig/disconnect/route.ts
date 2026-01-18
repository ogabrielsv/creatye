import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 1. Get current connection to get access token for revocation
        const { data: connection } = await supabase
            .from('ig_connections')
            .select('access_token, ig_business_account_id')
            .eq('user_id', user.id)
            .maybeSingle()

        if (connection?.access_token) {
            // 2. Best-effort token revocation
            try {
                // DELETE /{ig-user-id}/permissions (or /me/permissions)
                // Actually Graph API for removing app is DELETE /me/permissions or DELETE /{user-id}/permissions
                // But usually just revoking the token is usually done via:
                // DELETE https://graph.facebook.com/v19.0/me/permissions?access_token=...

                await fetch(`https://graph.facebook.com/v19.0/me/permissions?access_token=${connection.access_token}`, {
                    method: 'DELETE'
                })
            } catch (revocationError) {
                console.warn('Failed to revoke IG token on Facebook side:', revocationError)
                // Continue anyway to remove from our DB
            }
        }

        // 3. Remove from Supabase
        const { error: dbError } = await supabase
            .from('ig_connections')
            .delete()
            .eq('user_id', user.id)

        if (dbError) {
            console.error('Database Error deleting connection:', dbError)
            return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 })
        }

        return NextResponse.json({ ok: true })

    } catch (err: any) {
        console.error('Error in IG disconnect API:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
