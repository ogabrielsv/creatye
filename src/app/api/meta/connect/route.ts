import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID
    const REDIRECT_URI = process.env.META_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/meta/callback`

    if (!INSTAGRAM_APP_ID) {
        return NextResponse.json({ error: 'Missing INSTAGRAM_APP_ID env' }, { status: 500 })
    }

    // Generate state for CSRF protection
    const nonce = uuidv4()
    const stateData = {
        userId: user.id,
        nonce,
        ts: Date.now()
    }
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64')

    // Define scopes required for Instagram Business Login
    const scopes = [
        'instagram_business_basic',
        'instagram_business_manage_messages',
        'instagram_business_manage_comments',
        'instagram_business_content_publish',
    ].join(',')

    // Use the Instagram OAuth URL (NOT Facebook)
    const authUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${INSTAGRAM_APP_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${scopes}&state=${state}`

    const response = NextResponse.redirect(authUrl)

    // Set a short-lived cookie for state verification
    response.cookies.set('meta_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/', // Ensure path is root
        maxAge: 600 // 10 minutes
    })

    return response
}
