import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ connected: false }, { status: 401 })
        }

        const { data: connection, error } = await supabase
            .from('ig_connections')
            .select('ig_username, ig_profile_picture_url, ig_business_account_id, updated_at')
            .eq('user_id', user.id)
            .maybeSingle()

        if (error) {
            console.error('Error fetching IG connection:', error)
            return NextResponse.json({ error: 'Failed to fetch connection' }, { status: 500 })
        }

        if (!connection) {
            return NextResponse.json({ connected: false })
        }

        return NextResponse.json({
            connected: true,
            ...connection
        })

    } catch (err: any) {
        console.error('Error in IG connection API:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
