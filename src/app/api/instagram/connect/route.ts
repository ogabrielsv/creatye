import { createClient } from '@/lib/supabase/server-admin';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerEnv } from '@/lib/env';
import { createClient as createNextSupabase } from '@/lib/supabase/server'; // Auth user check

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const env = getServerEnv();

        // 1. Check Auth (Standard Next Supabase Client for correct session handling)
        const supabaseAuth = await createNextSupabase();
        const { data: { user } } = await supabaseAuth.auth.getUser();

        if (!user) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // 2. Generate Signed State
        // state struct: userId|timestamp|nonce|signature
        const timestamp = Date.now().toString();
        const nonce = crypto.randomBytes(8).toString('hex');
        const rawState = `${user.id}|${timestamp}|${nonce}`;
        const signature = crypto
            .createHmac('sha256', env.META_APP_SECRET)
            .update(rawState)
            .digest('hex');
        const state = `${rawState}|${signature}`;

        // 3. Build Auth URL (Meta OAuth for Business Permissions)
        // Using Facebook Dialog to ensure 'instagram_manage_messages' is grantable.
        // Instagram Basic Display (api.instagram.com) DOES NOT support DMs.
        const scopes = [
            'instagram_basic',
            'instagram_manage_messages',
            'pages_show_list',
            'pages_read_engagement'
        ].join(',');

        const params = new URLSearchParams({
            client_id: env.META_APP_ID,
            redirect_uri: env.META_REDIRECT_URI,
            response_type: 'code',
            scope: scopes,
            state: state
        });

        // We use Facebook OAuth because it's the only way to get DM permissions.
        // Force the UI? Facebook doesn't easily allow "Instagram-only" branding for business login
        // unless you are using "Log in with Instagram" for Basic Display (which kills DMs).
        // However, we can try to hint.
        const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;

        return NextResponse.redirect(authUrl);

    } catch (error: any) {
        console.error('[CONNECT_ERROR]', error);
        const settingsUrl = new URL('/settings', request.url);
        settingsUrl.searchParams.set('tab', 'integracoes');
        settingsUrl.searchParams.set('error', 'Erro interno ao iniciar conexão: ' + error.message);
        return NextResponse.redirect(settingsUrl);
    }
}
