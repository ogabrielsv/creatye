import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getMetaEnvOrThrow, MetaConfigError } from '@/lib/metaEnv';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
        const { appId, redirectUri } = getMetaEnvOrThrow();

        // Generate state securely
        const state = uuidv4();

        // Specific Scopes for DM Automation
        // Do not add extra pages_* scopes unless necessary for your specific app review
        const scopes = [
            'instagram_basic',
            'instagram_manage_messages',
            'pages_show_list',
            'pages_read_engagement'
        ].join(',');

        // Build Authorize URL with strict params
        const authParams = new URLSearchParams();
        authParams.append('client_id', appId);
        authParams.append('redirect_uri', redirectUri);
        authParams.append('response_type', 'code');
        authParams.append('scope', scopes);
        authParams.append('state', state);

        const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${authParams.toString()}`;

        const response = NextResponse.redirect(authUrl);

        // Store state in httpOnly cookie
        response.cookies.set('ig_oauth_state', state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 600, // 10 minutes
            sameSite: 'lax'
        });

        return response;

    } catch (error: any) {
        console.error('[IG_CONNECT_ERROR]', error);

        const settingsUrl = new URL('/settings', request.url);
        settingsUrl.searchParams.set('tab', 'integracoes');

        let msg = 'Erro interno ao iniciar conexão.';
        if (error instanceof MetaConfigError) {
            msg = error.message;
        } else if (error instanceof Error) {
            msg = error.message;
        }

        settingsUrl.searchParams.set('error', msg);
        return NextResponse.redirect(settingsUrl);
    }
}
