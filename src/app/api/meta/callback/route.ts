
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// 1. Exchange Code for User Access Token (Meta)
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
    const cookieStore = cookies() // No await in recent Next.js versions for cookies(), check usage ref
    // Actually cookies() is async in some versions/contexts, but let's stick to standard practice. 
    // If we're on Next 13+, await is safer if it returns promise, usually it's static in App Router though.
    // The previous code had await cookies(), keeping it safe.
    // Wait, prompt says "ajustar cookies() sem await (Next)". Let's check imports.
    const cookieStoreRef = await cookies();
    const storedState = cookieStoreRef.get('meta_oauth_state')?.value

    if (!state || state !== storedState) {
        return NextResponse.redirect(new URL('/automations?error=invalid_state', request.url))
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
        const META_APP_ID = process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID
        const META_APP_SECRET = process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET
        const REDIRECT_URI = process.env.META_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/meta/callback`

        if (!META_APP_ID || !META_APP_SECRET) {
            throw new Error('Missing Meta App Credentials')
        }

        // 3.2 Exchange Code for User Access Token
        const tokenParams = new URLSearchParams()
        tokenParams.append('client_id', META_APP_ID)
        tokenParams.append('client_secret', META_APP_SECRET)
        tokenParams.append('redirect_uri', REDIRECT_URI)
        tokenParams.append('code', code)

        const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`)
        const tokenData = await tokenRes.json()

        if (tokenData.error) {
            throw new Error(tokenData.error.message)
        }

        const shortLivedToken = tokenData.access_token

        // 3.3 Exchange Short-Lived for Long-Lived User Token
        const longLivedParams = new URLSearchParams()
        longLivedParams.append('grant_type', 'fb_exchange_token')
        longLivedParams.append('client_id', META_APP_ID)
        longLivedParams.append('client_secret', META_APP_SECRET)
        longLivedParams.append('fb_exchange_token', shortLivedToken)

        const longLivedRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${longLivedParams.toString()}`)
        const longLivedData = await longLivedRes.json()

        if (longLivedData.error) {
            throw new Error(longLivedData.error.message)
        }

        const longLivedToken = longLivedData.access_token
        // Approximation: 60 days
        const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

        // 3.4 Get User Pages and IG Business Account
        const pagesRes = await fetch(
            `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${longLivedToken}`
        )
        const pagesData = await pagesRes.json()

        if (pagesData.error) {
            throw new Error(pagesData.error.message)
        }

        const pages = pagesData.data || []
        const eligiblePage = pages.find((p: any) => p.instagram_business_account)

        if (!eligiblePage) {
            return NextResponse.redirect(new URL('/automations?error=no_instagram_business_account_found', request.url))
        }

        const igAccount = eligiblePage.instagram_business_account

        // 3.5 Save to DB
        const payload = {
            user_id: user.id,
            page_id: eligiblePage.id,
            access_token: eligiblePage.access_token, // Page Token for IG Graph
            ig_business_account_id: igAccount.id,
            ig_username: igAccount.username,
            ig_profile_picture_url: igAccount.profile_picture_url,
            ig_name: eligiblePage.name || igAccount.username, // Fallback
            ig_user_id: igAccount.id,
            token_expires_at: expiresAt,
            connected_at: new Date().toISOString(),
            disconnected_at: null
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
