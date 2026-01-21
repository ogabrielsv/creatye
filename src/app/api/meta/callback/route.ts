import { createServerClient } from '@/lib/supabase/server-admin';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const state = searchParams.get('state');

    const settingsUrl = new URL('/settings', request.url);
    settingsUrl.searchParams.set('tab', 'integracoes');

    // 1. Basic Query Checks
    if (errorParam) {
        settingsUrl.searchParams.set('error', 'Erro do provedor: ' + errorParam);
        return NextResponse.redirect(settingsUrl);
    }
    if (!code || !state) {
        settingsUrl.searchParams.set('error', 'Código ou estado ausente.');
        return NextResponse.redirect(settingsUrl);
    }

    try {
        const env = getServerEnv();

        // 2. Validate State Signature
        const parts = state.split('|');
        if (parts.length !== 4) throw new Error('Estado inválido (formato).');
        const [userId, timestamp, nonce, signature] = parts;

        // Check expiration (10 mins)
        if (Date.now() - parseInt(timestamp) > 600000) {
            throw new Error('Sessão expirada. Tente novamente.');
        }

        // Verify HMAC
        const rawState = `${userId}|${timestamp}|${nonce}`;
        const expectedSig = crypto
            .createHmac('sha256', env.META_APP_SECRET)
            .update(rawState)
            .digest('hex');

        if (signature !== expectedSig) {
            throw new Error('Falha de segurança (assinatura inválida).');
        }

        // 3. Exchange Code for Access Token
        const tokenParams = new URLSearchParams({
            client_id: env.META_APP_ID,
            client_secret: env.META_APP_SECRET,
            redirect_uri: env.META_REDIRECT_URI,
            code: code
        });

        const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`);
        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            console.error('[Meta Token Error]', tokenData.error);
            if (tokenData.error.message.includes('client secret')) {
                throw new Error('Secret inválido. Verifique configurações.');
            }
            throw new Error(tokenData.error.message);
        }

        const accessToken = tokenData.access_token;

        // 4. Get User Pages & IG Account
        const pagesRes = await fetch(
            `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${accessToken}`
        );
        const pagesData = await pagesRes.json();

        let connectedAccount = null;
        if (pagesData.data) {
            for (const page of pagesData.data) {
                if (page.instagram_business_account?.id) {
                    connectedAccount = {
                        pageId: page.id,
                        pageAccessToken: page.access_token,
                        igUserId: page.instagram_business_account.id,
                        username: page.instagram_business_account.username
                    };
                    break;
                }
            }
        }

        if (!connectedAccount) {
            throw new Error('Nenhuma conta Instagram Business encontrada nas Páginas do usuário.');
        }

        // 5. Persist to DB (using Service Role)
        const supabase = createServerClient();

        const payload = {
            user_id: userId,
            ig_user_id: connectedAccount.igUserId,
            ig_username: connectedAccount.username,
            access_token: accessToken, // User Token (short lived usually, but useful)
            page_access_token: connectedAccount.pageAccessToken, // Long lived page token for DMs
            page_id: connectedAccount.pageId,
            token_expires_at: null, // Basic tokens, usually 60 days for pages
            connected_at: new Date().toISOString(),
            disconnected_at: null
        };

        const { error: upsertError } = await supabase
            .from('instagram_accounts')
            .upsert(payload, {
                onConflict: 'user_id,ig_user_id' // Matches UNIQUE constraint added in migration
            });

        if (upsertError) {
            console.error('[DB Error]', upsertError);
            throw new Error('Erro ao salvar conexão no banco.');
        }

        settingsUrl.searchParams.set('ig', 'conectado');
        return NextResponse.redirect(settingsUrl);

    } catch (err: any) {
        console.error('[Callback Error]', err);
        settingsUrl.searchParams.set('error', err.message || 'Erro desconhecido');
        return NextResponse.redirect(settingsUrl);
    }
}
