import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    const redirectBase = new URL('/settings', request.url)

    if (error) {
        redirectBase.searchParams.set('error', error)
        return NextResponse.redirect(redirectBase)
    }

    if (!code) {
        redirectBase.searchParams.set('error', 'no_code')
        return NextResponse.redirect(redirectBase)
    }

    // Validate State using request cookies
    const storedState = request.cookies.get('meta_oauth_state')?.value

    if (!state || state !== storedState) {
        redirectBase.searchParams.set('error', 'invalid_state')
        return NextResponse.redirect(redirectBase)
    }

    // Auth Check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
        const INSTAGRAM_APP_ID = process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID
        const INSTAGRAM_APP_SECRET = process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET
        const REDIRECT_URI = process.env.META_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/api/meta/callback`

        if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET) {
            throw new Error('Missing App Credentials Envs')
        }

        // 1. Exchange Code for Access Token
        const tokenRes = await fetch(
            `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${INSTAGRAM_APP_ID}&client_secret=${INSTAGRAM_APP_SECRET}&redirect_uri=${REDIRECT_URI}&code=${code}`
        )
        const tokenData = await tokenRes.json()

        if (tokenData.error) {
            throw new Error(tokenData.error.message)
        }

        const accessToken = tokenData.access_token

        // 2. Get User's Pages and Instagram Accounts
        // We need the Connected Instagram Account ID and the Page Access Token
        const pagesRes = await fetch(
            `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${accessToken}`
        )
        const pagesData = await pagesRes.json()

        if (pagesData.error) {
            throw new Error(pagesData.error.message)
        }

        const pages = pagesData.data || []
        let connectedAccount = null

        // Find the first page with a connected Instagram Business Account
        for (const page of pages) {
            if (page.instagram_business_account && page.instagram_business_account.id) {
                connectedAccount = {
                    pageId: page.id,
                    pageName: page.name,
                    pageAccessToken: page.access_token, // IMPORTANT: Use THIS token for graph API calls
                    igUserId: page.instagram_business_account.id,
                    username: page.instagram_business_account.username,
                    profilePic: page.instagram_business_account.profile_picture_url
                }
                break
            }
        }

        if (!connectedAccount) {
            throw new Error('No Instagram Business Account connected to your Facebook Pages. Please connect one in Facebook Page Settings.')
        }

        // 3. Save to Supabase (using Service Role to bypass potential RLS during upserts if needed, though authenticating as user is better if policies allow)
        // We use Admin client here to ensure we can write to system tables if needed, but primarily to follow the request instruction to be robust.
        // Actually, adhering to RLS is better, but the user requested explicit service role usage in step 4.

        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: { persistSession: false }
            }
        )

        const payload = {
            user_id: user.id,
            instagram_id: connectedAccount.igUserId,
            page_id: connectedAccount.pageId,
            access_token: connectedAccount.pageAccessToken, // Store the PAGE token, it interacts with IG Graph API
            username: connectedAccount.username,
            updated_at: new Date().toISOString(),
            // Optional: You might want to save Token Expiry if available
        }

        const { error: upsertError } = await supabaseAdmin
            .from('instagram_accounts')
            .upsert(payload, { onConflict: 'instagram_id' })

        if (upsertError) {
            throw new Error('DB Error: ' + upsertError.message)
        }

        // Also update legacy table if needed (optional)
        const legacyPayload = {
            user_id: user.id,
            ig_user_id: connectedAccount.igUserId,
            instagram_business_account_id: connectedAccount.igUserId,
            access_token: connectedAccount.pageAccessToken,
            updated_at: new Date().toISOString()
        }
        await supabaseAdmin.from('ig_connections').upsert(legacyPayload, { onConflict: 'user_id' })

        redirectBase.searchParams.set('connected', 'true')
        return NextResponse.redirect(redirectBase)

    } catch (err: any) {
        console.error('Meta Callback Error:', err)
        redirectBase.searchParams.set('error', err.message || 'Unknown Error')
        return NextResponse.redirect(redirectBase)
    }
}
