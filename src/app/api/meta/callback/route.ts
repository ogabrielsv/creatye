
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    if (error) {
        return NextResponse.redirect(new URL(`/automations?error=${error}`, request.url))
    }

    if (!code) {
        return NextResponse.redirect(new URL('/automations?error=no_code', request.url))
    }

    // Validate State
    const cookieStore = await cookies()
    const storedState = cookieStore.get('meta_oauth_state')?.value

    if (!state || state !== storedState) {
        // In production, we should enforce state validation.
        // For now, if state is missing in cookie (e.g. cross-browser), we might be lenient or fail.
        // Let's fail for security as requested.
        return NextResponse.redirect(new URL('/automations?error=invalid_state', request.url))
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
        const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID
        const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET
        const REDIRECT_URI = process.env.META_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/meta/callback`

        if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET) {
            throw new Error('Missing Instagram App Credentials')
        }

        // 1. Exchange Code for Short-Lived Access Token (Instagram API)
        const formData = new FormData()
        formData.append('client_id', INSTAGRAM_APP_ID)
        formData.append('client_secret', INSTAGRAM_APP_SECRET)
        formData.append('grant_type', 'authorization_code')
        formData.append('redirect_uri', REDIRECT_URI)
        formData.append('code', code)

        const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
            method: 'POST',
            body: formData,
        })
        const tokenData = await tokenRes.json()

        if (tokenData.error_message || tokenData.error) {
            throw new Error(tokenData.error_message || JSON.stringify(tokenData.error))
        }

        const shortLivedToken = tokenData.access_token
        const igUserId = tokenData.user_id // Basic ID from token exchange

        // 2. Exchange Short-Lived for Long-Lived Token
        // Endpoint: https://graph.instagram.com/access_token
        const longLivedRes = await fetch(
            `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_APP_SECRET}&access_token=${shortLivedToken}`
        )
        const longLivedData = await longLivedRes.json()

        if (longLivedData.error) {
            throw new Error(longLivedData.error.message)
        }

        const longLivedToken = longLivedData.access_token || shortLivedToken
        const expiresSeconds = longLivedData.expires_in || 5184000
        const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString()

        // 3. Get User Details
        // We need the username and hopefully a more stable ID if possible.
        // With Instagram Business Login, we are authenticating AS the Instagram User directly.

        const userDetailsRes = await fetch(
            `https://graph.instagram.com/v19.0/me?fields=user_id,username,name,account_type,profile_picture_url&access_token=${longLivedToken}`
        )
        const userDetails = await userDetailsRes.json()

        if (userDetails.error) {
            throw new Error(userDetails.error.message)
        }

        const finalIgUserId = userDetails.user_id || userDetails.id || igUserId
        const finalIgUsername = userDetails.username

        // 4. Save to Supabase
        // We do NOT use page_id or page_access_token here as this is direct IG login.

        const { error: dbError } = await supabase
            .from('ig_connections')
            .upsert(
                {
                    user_id: user.id,
                    page_id: null, // User requested page_id (even if null)
                    ig_business_account_id: finalIgUserId, // User requested ig_business_account_id to match igUserId/finalIgUserId
                    access_token: longLivedToken,
                    token_expires_at: expiresAt,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'user_id' }
            )

        if (dbError) {
            console.error('Database Error:', dbError)
            const details = [dbError.code, dbError.message, dbError.details, dbError.hint].filter(Boolean).join(' | ')
            throw new Error(`DB_UPSERT_ERROR: ${details}`)
        }

        return NextResponse.redirect(new URL('/automations?connected=true', request.url))

    } catch (err: any) {
        console.error('Instagram Callback Error:', err)
        return NextResponse.redirect(new URL(`/automations?error=${encodeURIComponent(err.message)}`, request.url))
    }
}
