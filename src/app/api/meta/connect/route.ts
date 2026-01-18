
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

    const META_APP_ID = process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID
    const REDIRECT_URI = process.env.META_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/meta/callback`

    if (!META_APP_ID) {
        return NextResponse.json({ error: 'Missing META_APP_ID env' }, { status: 500 })
    }

    // Generate state for CSRF protection
    const nonce = uuidv4()
    const stateData = {
        userId: user.id,
        nonce,
        ts: Date.now()
    }
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64')

    // Define scopes required for Instagram Business Login via Facebook OAuth
    const scopes = [
        'instagram_basic',
        'instagram_manage_messages',
        'instagram_manage_comments',
        'pages_show_list',
        'pages_read_engagement',
        'business_management'
    ].join(',')

    // Use the Facebook Dialog OAuth URL
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${scopes}&state=${state}`

    const response = NextResponse.redirect(authUrl)

    // Set a short-lived cookie for state verification
    response.cookies.set('meta_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 600, // 10 minutes
        sameSite: 'lax'
    })

    return response
}
