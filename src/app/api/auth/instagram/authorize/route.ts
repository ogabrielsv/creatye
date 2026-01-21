import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { createSignedState } from '@/lib/instagram/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const env = getServerEnv();
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // Generate Signed State
        const statePayload = {
            userId: user.id,
            nonce: crypto.randomUUID(),
            iat: Date.now(),
            exp: Date.now() + 10 * 60 * 1000 // 10 minutes
        };
        const state = createSignedState(statePayload, env.AUTH_STATE_SECRET);

        // Instagram Basic Display Authorize URL
        // https://www.instagram.com/oauth/authorize
        // ?client_id={app-id}&redirect_uri={redirect-uri}&scope=user_profile,user_media&response_type=code

        const params = new URLSearchParams({
            client_id: env.INSTAGRAM_CLIENT_ID,
            redirect_uri: env.INSTAGRAM_REDIRECT_URI,
            scope: 'user_profile,user_media',
            response_type: 'code',
            state: state,
            // 'force_authentication': '1' // Uncomment if you want to force re-login
        });

        const authUrl = `https://www.instagram.com/oauth/authorize?${params.toString()}`;

        return NextResponse.redirect(authUrl);

    } catch (error: any) {
        console.error('[AUTH_INIT_ERROR]', error);
        return NextResponse.redirect(new URL('/settings?error=Falha+ao+iniciar+login', request.url));
    }
}
