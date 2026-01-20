import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    const INSTAGRAM_APP_ID = process.env.META_APP_ID
    const REDIRECT_URI = process.env.META_REDIRECT_URI

    if (!INSTAGRAM_APP_ID || !REDIRECT_URI) {
        return NextResponse.json({ error: 'Missing META_APP_ID or META_REDIRECT_URI' }, { status: 500 })
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

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${INSTAGRAM_APP_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${scopes}&state=${state}`

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
