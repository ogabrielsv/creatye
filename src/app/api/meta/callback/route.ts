import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getMetaEnvOrThrow, MetaConfigError } from '@/lib/metaEnv';
import { getSafeConfigColumns } from '@/lib/supabase/safe-columns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const state = searchParams.get('state');

    const settingsUrl = new URL('/settings', request.url);
    settingsUrl.searchParams.set('tab', 'integracoes');

    // 1. Basic Checks
    if (errorParam) {
        settingsUrl.searchParams.set('error', 'Erro do Facebook: ' + errorParam);
        return NextResponse.redirect(settingsUrl);
    }
    if (!code) {
        settingsUrl.searchParams.set('error', 'Código de autorização não recebido.');
        return NextResponse.redirect(settingsUrl);
    }
    const storedState = request.cookies.get('ig_oauth_state')?.value;
    if (!state || state !== storedState) {
        settingsUrl.searchParams.set('error', 'Sessão inválida (CSRF). Tente novamente.');
        return NextResponse.redirect(settingsUrl);
    }

    // 2. Auth Check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
        const { appId, appSecret, redirectUri } = getMetaEnvOrThrow();

        // 3. Exchange Code
        const tokenParams = new URLSearchParams();
        tokenParams.append('client_id', appId);
        tokenParams.append('client_secret', appSecret);
        tokenParams.append('redirect_uri', redirectUri);
        tokenParams.append('code', code);

        const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`);
        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            console.error('[Meta Token Error]', tokenData.error);
            if (tokenData.error.message.includes('client secret')) {
                throw new MetaConfigError('Secret inválido: Verifique se META_APP_SECRET confere com o App ID.');
            }
            throw new Error(tokenData.error.message);
        }

        const accessToken = tokenData.access_token;

        // 4. Get Pages
        const pagesRes = await fetch(
            `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${accessToken}`
        );
        const pagesData = await pagesRes.json();
        if (pagesData.error) throw new Error(pagesData.error.message);

        const pages = pagesData.data || [];
        let connectedAccount = null;

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
            throw new Error('Nenhuma conta comercial do Instagram vinculada às suas Páginas.');
        }

        // 5. Build Safe Payload using explicit required fields + logic
        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        // Required minimal schema we enforce
        const payload: any = {
            user_id: user.id,
            instagram_id: connectedAccount.igUserId, // kept for unique constraint
            ig_user_id: connectedAccount.igUserId,
            updated_at: new Date().toISOString()
        };

        // Get safe columns (fallback to known superset from migration)
        const safeCols = await getSafeConfigColumns(supabaseAdmin);

        if (safeCols.has('page_access_token')) payload.page_access_token = connectedAccount.pageAccessToken;
        if (safeCols.has('page_id')) payload.page_id = connectedAccount.pageId;
        if (safeCols.has('user_access_token')) payload.user_access_token = accessToken;
        if (safeCols.has('ig_username')) payload.ig_username = connectedAccount.username;
        if (safeCols.has('disconnected_at')) payload.disconnected_at = null;

        const { error: upsertError } = await supabaseAdmin
            .from('instagram_accounts')
            .upsert(payload, { onConflict: 'user_id' });

        if (upsertError) {
            console.error('[DB Error]', upsertError);
            // Verify if error is about missing column despite our check (race condition or migration lag)
            if (upsertError.message.includes('column')) {
                throw new Error('Erro de esquema de banco de dados. Contate o suporte.');
            }
            throw new Error('Erro ao salvar conexão: ' + upsertError.message);
        }

        settingsUrl.searchParams.set('ig', 'conectado');
        return NextResponse.redirect(settingsUrl);

    } catch (err: any) {
        console.error('[Callback Logic Error]', err);
        const msg = err instanceof MetaConfigError ? err.message : (err.message || 'Erro desconhecido');
        settingsUrl.searchParams.set('error', msg);
        return NextResponse.redirect(settingsUrl);
    }
}
