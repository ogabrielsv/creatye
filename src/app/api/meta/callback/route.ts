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
    const cookieStore = cookies()
    const storedState = cookieStore.get('meta_oauth_state')?.value

    if (!state || state !== storedState) {
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
        const params = new URLSearchParams()
        params.append('client_id', INSTAGRAM_APP_ID)
        params.append('client_secret', INSTAGRAM_APP_SECRET)
        params.append('grant_type', 'authorization_code')
        params.append('redirect_uri', REDIRECT_URI)
        params.append('code', code)

        const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
            method: 'POST',
            body: params // URLSearchParams sets default content-type header for form-urlencoded
        })
        const tokenData = await tokenRes.json()

        if (tokenData.error_message || tokenData.error) {
            throw new Error(tokenData.error_message || JSON.stringify(tokenData.error))
        }

        const shortLivedToken = tokenData.access_token
        // Note: standard IG OAuth might return 'user_id' in tokenData

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
        // We use graph.instagram.com/me as requested
        const userDetailsRes = await fetch(
            `https://graph.instagram.com/me?fields=id,username,account_type,profile_picture_url&access_token=${longLivedToken}`
        )
        const userDetails = await userDetailsRes.json()

        if (userDetails.error) {
            throw new Error(userDetails.error.message)
        }

        const finalIgUserId = userDetails.id
        const finalIgUsername = userDetails.username
        const finalIgProfilePic = userDetails.profile_picture_url
        // Use username as fallback name since /me might not return 'name' for some account types or scopes
        const finalIgName = userDetails.username

        // 4. Save to Supabase
        // Only standardized fields. No page_id unless we did FB flow.

        const payload: any = {
            user_id: user.id,
            access_token: longLivedToken,
            token_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
            connected_at: new Date().toISOString(),
            disconnected_at: null,

            // Standardized IG fields
            ig_user_id: finalIgUserId,
            ig_username: finalIgUsername,
            ig_name: finalIgName,
            ig_profile_picture_url: finalIgProfilePic,
        }

        const { error: dbError } = await supabase
            .from('ig_connections')
            .upsert(payload, { onConflict: 'user_id' })

        if (dbError) {
            console.error('Database Error:', dbError)
            return NextResponse.redirect(new URL(`/automations?error=DB_UPSERT_ERROR:${dbError.code}`, request.url))
        }

        return NextResponse.redirect(new URL('/automations?connected=true', request.url))

    } catch (err: any) {
        console.error('Instagram Callback Error:', err)
        return NextResponse.redirect(new URL(`/automations?error=${encodeURIComponent(err.message)}`, request.url))
    }
}
