import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    // Prepare redirect URL foundation
    const settingsUrl = new URL('/settings', request.url)
    settingsUrl.searchParams.set('tab', 'integracoes')

    // Handle initial errors
    if (error) {
        settingsUrl.searchParams.set('error', 'Erro no login: ' + error)
        return NextResponse.redirect(settingsUrl)
    }

    if (!code) {
        settingsUrl.searchParams.set('error', 'Código de autorização não recebido')
        return NextResponse.redirect(settingsUrl)
    }

    // Validate State
    const storedState = request.cookies.get('ig_oauth_state')?.value
    if (!state || state !== storedState) {
        // Fallback: checks if maybe using old cookie name from previous attempts
        const legacyState = request.cookies.get('meta_oauth_state')?.value
        if (!state || state !== legacyState) {
            settingsUrl.searchParams.set('error', 'Estado de segurança inválido (CSRF)')
            return NextResponse.redirect(settingsUrl)
        }
    }

    // Auth Check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
        const META_APP_ID = process.env.META_APP_ID
        const META_APP_SECRET = process.env.META_APP_SECRET
        const REDIRECT_URI = process.env.META_REDIRECT_URI

        if (!META_APP_ID || !META_APP_SECRET || !REDIRECT_URI) {
            throw new Error('Configuração de servidor incompleta (Env vars)')
        }

        // 1. Exchange Code for Access Token
        const tokenRes = await fetch(
            `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&redirect_uri=${REDIRECT_URI}&code=${code}`
        )
        const tokenData = await tokenRes.json()

        if (tokenData.error) {
            console.error('Meta Token Error:', tokenData.error)
            throw new Error('Erro ao validar token: ' + tokenData.error.message)
        }

        const accessToken = tokenData.access_token

        // 2. Get User's Pages and Instagram Accounts
        const pagesRes = await fetch(
            `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${accessToken}`
        )
        const pagesData = await pagesRes.json()

        if (pagesData.error) {
            throw new Error('Erro ao buscar páginas: ' + pagesData.error.message)
        }

        const pages = pagesData.data || []
        let connectedAccount = null

        // Find first page with IG business account
        for (const page of pages) {
            if (page.instagram_business_account && page.instagram_business_account.id) {
                connectedAccount = {
                    pageId: page.id,
                    pageAccessToken: page.access_token,
                    igUserId: page.instagram_business_account.id,
                    username: page.instagram_business_account.username
                }
                break
            }
        }

        if (!connectedAccount) {
            throw new Error('Nenhuma conta comercial do Instagram vinculada às suas Páginas do Facebook.')
        }

        // 3. Save to Supabase (using Service Role)
        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        )

        const payload = {
            user_id: user.id,
            instagram_id: connectedAccount.igUserId, // kept for constraint unique
            page_id: connectedAccount.pageId,
            page_access_token: connectedAccount.pageAccessToken, // CRITICAL: The Page Token
            user_access_token: accessToken, // Optional
            ig_user_id: connectedAccount.igUserId,
            ig_username: connectedAccount.username,
            updated_at: new Date().toISOString(),
            token_updated_at: new Date().toISOString(),
            disconnected_at: null
        }

        const { error: upsertError } = await supabaseAdmin
            .from('instagram_accounts')
            .upsert(payload, { onConflict: 'instagram_id' })

        if (upsertError) {
            throw new Error('Erro ao salvar no banco: ' + upsertError.message)
        }

        settingsUrl.searchParams.set('ig', 'conectado')
        return NextResponse.redirect(settingsUrl)

    } catch (err: any) {
        console.error('Callback Error:', err)
        settingsUrl.searchParams.set('error', err.message || 'Erro desconhecido')
        return NextResponse.redirect(settingsUrl)
    }
}
