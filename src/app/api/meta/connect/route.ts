
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    const APP_ID = process.env.META_APP_ID
    // Ensure we use the exact redirect URI registered in Meta
    const REDIRECT_URI = process.env.META_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/meta/callback`

    if (!APP_ID) {
        return NextResponse.json({ error: 'Missing META_APP_ID env' }, { status: 500 })
    }

    // Generate state for CSRF protection
    // Combining userId, nonce, and timestamp
    const nonce = uuidv4()
    const stateData = {
        userId: user.id,
        nonce,
        ts: Date.now()
    }
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64')

    // Define scopes required for Instagram Automation
    const scopes = [
        'instagram_business_basic',
        'instagram_manage_comments',
        'instagram_business_manage_messages',
        'pages_show_list',
        'pages_read_engagement'
    ].join(',')

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${scopes}&state=${state}`

    // We rely on the state param for CSRF validation in the callback.
    // Ideally we would set a cookie here to verify against, but strictly relying on base64(signed_data) or database state is also a pattern.
    // The requirement suggests "cookie httpOnly".

    const response = NextResponse.redirect(authUrl)

    // Set a short-lived cookie for state verification
    response.cookies.set('meta_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/api/meta', // limit scope
        maxAge: 600 // 10 minutes
    })

    return response
}
