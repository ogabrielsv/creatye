
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state') // Should be user_id

    if (error) {
        return NextResponse.redirect(new URL(`/settings?error=${error}`, request.url))
    }

    if (!code) {
        return NextResponse.redirect(new URL('/settings?error=no_code', request.url))
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // Double check state matches user if we were storing it strictly, 
    // currently we just use it to pass info if needed, but we rely on session auth.

    try {
        // 1. Exchange Code for Short-Lived Access Token
        const APP_ID = process.env.META_APP_ID
        const APP_SECRET = process.env.META_APP_SECRET
        const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/callback`

        const tokenRes = await fetch(
            `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${APP_SECRET}&code=${code}`
        )
        const tokenData = await tokenRes.json()

        if (tokenData.error) {
            throw new Error(tokenData.error.message)
        }

        const shortLivedToken = tokenData.access_token

        // 2. Exchange Short-Lived for Long-Lived Token
        const longLivedRes = await fetch(
            `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortLivedToken}`
        )
        const longLivedData = await longLivedRes.json()

        // Fallback if exchange fails (some permissions dont allow it?) usually it works
        const accessToken = longLivedData.access_token || shortLivedToken
        const expiresSeconds = longLivedData.expires_in || tokenData.expires_in || 5184000 // 60 days default
        const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString()

        // 3. Get User Pages to find the connected Instagram Account
        const pagesRes = await fetch(
            `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
        )
        const pagesData = await pagesRes.json()

        // Simple logic: Find first page with connected instagram_business_account
        // In production, might want to let user select which page.
        let pageId = null
        let igUserId = null
        let igUsername = null

        if (pagesData.data && pagesData.data.length > 0) {
            // Find one with IG
            for (const page of pagesData.data) {
                // Need to fetch details to see instagram_business_account? 
                // Usually it's in the fields if requested, or we iterate.
                // Let's request fields=instagram_business_account
                const pageDetailsRes = await fetch(
                    `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account,access_token&access_token=${accessToken}`
                )
                const pageDetails = await pageDetailsRes.json()

                if (pageDetails.instagram_business_account) {
                    pageId = page.id
                    igUserId = pageDetails.instagram_business_account.id

                    // Get IG Username
                    const igUserRes = await fetch(
                        `https://graph.facebook.com/v18.0/${igUserId}?fields=username&access_token=${accessToken}`
                    )
                    const igUserData = await igUserRes.json()
                    igUsername = igUserData.username
                    break
                }
            }
        }

        if (!igUserId) {
            throw new Error('No Instagram Business account connected to your Facebook Pages.')
        }

        // 4. Save to Supabase
        const { error: dbError } = await supabase.from('ig_connections').upsert({
            user_id: user.id,
            provider: 'instagram',
            access_token: accessToken,
            token_expires_at: expiresAt,
            page_id: pageId,
            ig_user_id: igUserId,
            username: igUsername,
            updated_at: new Date().toISOString()
        })

        if (dbError) {
            console.error('Database Error:', dbError)
            throw new Error('Failed to save connection.')
        }

        return NextResponse.redirect(new URL('/settings?success=connected', request.url))

    } catch (err: any) {
        console.error('Meta Callback Error:', err)
        return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(err.message)}`, request.url))
    }
}
