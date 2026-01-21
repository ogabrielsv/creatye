import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    const INSTAGRAM_APP_ID = process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID
    const REDIRECT_URI = process.env.META_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/api/meta/callback`

    if (!INSTAGRAM_APP_ID) {
        return NextResponse.json({ error: 'Missing META_APP_ID/INSTAGRAM_APP_ID env' }, { status: 500 })
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
    // These specific scopes are required for messaging and automation
    // Define scopes required for Instagram Business Login
    // These specific scopes are required for messaging and automation
    const scopes = [
        'instagram_basic',
        'instagram_manage_messages',
        'pages_show_list',
        'pages_read_engagement',
        'business_management'
    ].join(',')

    // Use the Facebook OAuth Dialog (Standard for Business Integration)
    // Instagram messaging permissions are often granted via "Facebook Login for Business" flow 
    // which manages Pages + Instagram accounts together.
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${INSTAGRAM_APP_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${scopes}&state=${state}`

    const response = NextResponse.redirect(authUrl)

    // Set a short-lived cookie for state verification
    response.cookies.set('meta_oauth_state', state, {
        httpOnly: true, Send "Eu quer
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 600, // 10 minutes
        sameSite: 'lax'
    })

    return response
}
