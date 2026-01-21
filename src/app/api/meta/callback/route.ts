import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getMetaEnvOrThrow, MetaConfigError } from '@/lib/metaEnv';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const state = searchParams.get('state');

    // Base URL for redirects
    const settingsUrl = new URL('/settings', request.url);
    settingsUrl.searchParams.set('tab', 'integracoes');

    // 1. Check for basic query errors
    if (errorParam) {
        settingsUrl.searchParams.set('error', 'Erro retornado pelo Facebook: ' + errorParam);
        return NextResponse.redirect(settingsUrl);
    }

    if (!code) {
        settingsUrl.searchParams.set('error', 'Código de autorização não recebido.');
        return NextResponse.redirect(settingsUrl);
    }

    // 2. Validate State (CSRF)
    const storedState = request.cookies.get('ig_oauth_state')?.value;
    if (!state || state !== storedState) {
        settingsUrl.searchParams.set('error', 'Sessão inválida (erro de estado CSRF). Tente novamente.');
        return NextResponse.redirect(settingsUrl);
    }

    // 3. Auth Check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
        // 4. Validate Env Vars
        const { appId, appSecret, redirectUri } = getMetaEnvOrThrow();

        // 5. Exchange Code for Access Token
        const tokenParams = new URLSearchParams();
        tokenParams.append('client_id', appId);
        tokenParams.append('client_secret', appSecret);
        tokenParams.append('redirect_uri', redirectUri);
        tokenParams.append('code', code);

        const tokenRes = await fetch(
            `https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`
        );
        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            console.error('Meta Token Error:', tokenData.error);
            // Specific friendly message for secret error
            if (tokenData.error.message.includes('client secret')) {
                throw new MetaConfigError(
                    'Secret inválido: confira se META_APP_SECRET pertence ao mesmo App ID informado e faça Redeploy no Vercel.'
                );
            }
            throw new Error('Erro ao validar token: ' + tokenData.error.message);
        }

        const accessToken = tokenData.access_token;

        // 6. Get User's Pages
        const pagesRes = await fetch(
            `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${accessToken}`
        );
        const pagesData = await pagesRes.json();

        if (pagesData.error) {
            throw new Error('Erro ao buscar páginas: ' + pagesData.error.message);
        }

        const pages = pagesData.data || [];
        let connectedAccount = null;

        // Find first page with IG business account
        for (const page of pages) {
            if (page.instagram_business_account && page.instagram_business_account.id) {
                connectedAccount = {
                    pageId: page.id,
                    pageAccessToken: page.access_token,
                    igUserId: page.instagram_business_account.id,
                    username: page.instagram_business_account.username
                };
                break;
            }
        }

        if (!connectedAccount) {
            throw new Error('Nenhuma conta comercial do Instagram vinculada às suas Páginas do Facebook.');
        }

        // 7. Save to Supabase (using Service Role)
        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        const payload = {
            user_id: user.id,
            instagram_id: connectedAccount.igUserId,
            page_id: connectedAccount.pageId,
            page_access_token: connectedAccount.pageAccessToken,
            user_access_token: accessToken,
            ig_user_id: connectedAccount.igUserId,
            ig_username: connectedAccount.username,
            updated_at: new Date().toISOString(),
            disconnected_at: null
        };

        const { error: upsertError } = await supabaseAdmin
            .from('instagram_accounts')
            .upsert(payload, { onConflict: 'user_id' });

        if (upsertError) {
            throw new Error('Erro ao salvar no banco: ' + upsertError.message);
        }

        settingsUrl.searchParams.set('ig', 'conectado');
        return NextResponse.redirect(settingsUrl);

    } catch (err: any) {
        console.error('Callback Error:', err);

        // Ensure error message is readable string
        const errMsg = err instanceof MetaConfigError ? err.message : (err.message || 'Erro desconhecido');
        settingsUrl.searchParams.set('error', errMsg);

        return NextResponse.redirect(settingsUrl);
    }
}
