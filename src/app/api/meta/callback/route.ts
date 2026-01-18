
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    // In strict oauth flow we should validate state.
    // const state = searchParams.get('state') 

    if (error) {
        return NextResponse.redirect(new URL(`/automations?error=${error}`, request.url))
    }

    if (!code) {
        return NextResponse.redirect(new URL('/automations?error=no_code', request.url))
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
        // 1. Exchange Code for Short-Lived Access Token
        const APP_ID = process.env.META_APP_ID
        const APP_SECRET = process.env.META_APP_SECRET
        const REDIRECT_URI = process.env.META_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/meta/callback`

        const tokenRes = await fetch(
            `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${APP_SECRET}&code=${code}`
        )
        const tokenData = await tokenRes.json()

        if (tokenData.error) {
            throw new Error(tokenData.error.message)
        }

        const shortLivedToken = tokenData.access_token

        // 2. Exchange Short-Lived for Long-Lived Token
        const longLivedRes = await fetch(
            `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortLivedToken}`
        )
        const longLivedData = await longLivedRes.json()

        const userAccessToken = longLivedData.access_token || shortLivedToken
        const expiresSeconds = longLivedData.expires_in || tokenData.expires_in || 5184000 // 60 days default
        const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString()

        // 3. Get User Pages to find the connected Instagram Account
        const pagesRes = await fetch(
            `https://graph.facebook.com/v19.0/me/accounts?access_token=${userAccessToken}`
        )
        const pagesData = await pagesRes.json()

        let pageId = null
        let igUserId = null
        let igUsername = null
        let pageAccessToken = null

        if (pagesData.data && pagesData.data.length > 0) {
            // Find one with IG
            for (const page of pagesData.data) {
                // Fetch page details including access_token and instagram_business_account
                const pageDetailsRes = await fetch(
                    `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account,access_token&access_token=${userAccessToken}`
                )
                const pageDetails = await pageDetailsRes.json()

                if (pageDetails.instagram_business_account) {
                    pageId = page.id
                    igUserId = pageDetails.instagram_business_account.id
                    pageAccessToken = pageDetails.access_token // This is the Page Access Token

                    // Get IG Username
                    const igUserRes = await fetch(
                        `https://graph.facebook.com/v19.0/${igUserId}?fields=username&access_token=${userAccessToken}`
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
            access_token: userAccessToken, // Keeping legacy column filled just in case
            user_access_token: userAccessToken,
            page_access_token: pageAccessToken,
            token_expires_at: expiresAt,
            page_id: pageId,
            ig_user_id: igUserId,
            username: igUsername,      // Legacy column
            ig_username: igUsername,   // New column
            updated_at: new Date().toISOString()
        })

        if (dbError) {
            console.error('Database Error:', dbError)
            throw new Error('Failed to save connection.')
        }

        return NextResponse.redirect(new URL('/automations?connected=true', request.url))

    } catch (err: any) {
        console.error('Meta Callback Error:', err)
        return NextResponse.redirect(new URL(`/automations?error=${encodeURIComponent(err.message)}`, request.url))
    }
}
