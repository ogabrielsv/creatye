import { createServerClient } from '@/lib/supabase/server-admin';
import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { verifySignedState } from '@/lib/instagram/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const state = searchParams.get('state');

    const redirectOnError = (msg: string) => {
        const url = new URL('/settings', request.url);
        url.searchParams.set('tab', 'integracoes');
        url.searchParams.set('error', msg);
        return NextResponse.redirect(url);
    };

    if (errorParam) return redirectOnError(`Erro do Instagram: ${errorParam}`);
    if (!code || !state) return redirectOnError('Código ou estado ausente.');

    try {
        const env = getServerEnv();
        const payload = verifySignedState(state, env.AUTH_STATE_SECRET);
        const userId = payload.userId;

        // 1. Exchange Code for Short-Lived Token
        const form = new FormData();
        form.append('client_id', env.INSTAGRAM_CLIENT_ID);
        form.append('client_secret', env.INSTAGRAM_CLIENT_SECRET);
        form.append('grant_type', 'authorization_code');
        form.append('redirect_uri', env.INSTAGRAM_REDIRECT_URI);
        form.append('code', code);

        const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
            method: 'POST',
            body: form
        });
        const shortData = await shortRes.json();

        if (shortData.error_message || !shortData.access_token) {
            throw new Error(shortData.error_message || 'Falha ao obter token curto');
        }

        const shortToken = shortData.access_token;
        const igUserId = shortData.user_id; // Basic Display returns this

        // 2. Exchange for Long-Lived Token
        const longRes = await fetch(
            `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${env.INSTAGRAM_CLIENT_SECRET}&access_token=${shortToken}`
        );
        const longData = await longRes.json();

        if (longData.error || !longData.access_token) {
            throw new Error(longData.error?.message || 'Falha ao trocar por token longo');
        }

        const longToken = longData.access_token;
        const expiresIn = longData.expires_in || 5184000; // ~60 days default
        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        // 3. Fetch User Profile (Username)
        const profileRes = await fetch(
            `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${longToken}`
        );
        const profileData = await profileRes.json();

        if (profileData.error) throw new Error('Falha ao obter perfil');

        // 4. Upsert Account
        const supabase = createServerClient();

        const accountData = {
            user_id: userId,
            ig_user_id: igUserId.toString(),
            username: profileData.username,
            access_token: longToken,
            token_type: 'bearer',
            expires_at: expiresAt.toISOString(),
            status: 'connected',
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data: account, error: dbError } = await supabase
            .from('instagram_accounts')
            .upsert(accountData, { onConflict: 'user_id' })
            .select()
            .single();

        if (dbError) throw dbError;

        // 5. Create Default Jobs
        if (account) {
            // Check if job exists
            const { count } = await supabase
                .from('automation_jobs')
                .select('*', { count: 'exact', head: true })
                .eq('instagram_account_id', account.id)
                .eq('type', 'SYNC_MEDIA');

            if (count === 0) {
                await supabase.from('automation_jobs').insert({
                    user_id: userId,
                    instagram_account_id: account.id,
                    name: 'Sincronizar Mídia',
                    type: 'SYNC_MEDIA',
                    schedule: '*/5 * * * *',
                    enabled: true
                });
            }
        }

        const successUrl = new URL('/settings', request.url);
        successUrl.searchParams.set('tab', 'integracoes');
        successUrl.searchParams.set('ig', 'connected');
        return NextResponse.redirect(successUrl);

    } catch (e: any) {
        console.error('[CALLBACK_ERROR]', e);
        // Log to DB if possible (requires us to know user_id, which we might have from state)
        // For now, simpler return
        return redirectOnError(e.message || 'Erro desconhecido');
    }
}
