import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    const client_id = process.env.META_APP_ID
    const redirect_uri = process.env.META_REDIRECT_URI

    if (!client_id || !redirect_uri) {
        return NextResponse.json(
            { error: 'Configuração do Instagram ausente (META_APP_ID/META_APP_SECRET/META_REDIRECT_URI).' },
            { status: 500 }
        )
    }

    // Generate state securely
    const state = uuidv4()

    // Valid scopes ONLY
    const scopes = [
        'instagram_basic',
        'instagram_manage_messages',
        'pages_show_list',
        'pages_read_engagement'
    ].join(',')

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${client_id}&redirect_uri=${redirect_uri}&response_type=code&scope=${scopes}&state=${state}`

    const response = NextResponse.redirect(authUrl)

    // Store state in httpOnly cookie
    response.cookies.set('ig_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 600, // 10 minutes
        sameSite: 'lax'
    })

    return response
}
