import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerEnv } from "@/lib/env";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function base64url(input: string) {
    return Buffer.from(input).toString("base64url");
}

function createState(secret: string, nonce: string) {
    const now = Date.now();
    const payload = {
        nonce: nonce,
        iat: now, // timestamp as requested
        exp: now + 10 * 60 * 1000,
        next: "/settings?tab=integracoes"
    };
    const body = base64url(JSON.stringify(payload));
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${sig}`;
}

export async function GET(req: Request) {
    const env = getServerEnv();
    const appUrl = env.APP_URL;

    try {
        console.info("[IG CONNECT] Starting flow");

        // Validate redirect URI
        if (!env.INSTAGRAM_REDIRECT_URI.startsWith("https://")) {
            throw new Error(`INSTAGRAM_REDIRECT_URI deve iniciar com https://. Valor: ${env.INSTAGRAM_REDIRECT_URI}`);
        }

        console.info(`[IG CONNECT] redirect_uri=${env.INSTAGRAM_REDIRECT_URI}`);

        // Generate State
        const nonce = crypto.randomBytes(16).toString("hex");
        const state = createState(env.AUTH_STATE_SECRET, nonce);

        // Build Official Instagram OAuth URL
        // https://www.instagram.com/oauth/authorize
        const authUrl = new URL("https://www.instagram.com/oauth/authorize");
        authUrl.searchParams.set("client_id", env.INSTAGRAM_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", env.INSTAGRAM_REDIRECT_URI);
        authUrl.searchParams.set("response_type", "code");

        // Exact scopes as requested
        authUrl.searchParams.set("scope", "instagram_business_basic,instagram_manage_comments,instagram_business_manage_messages");

        authUrl.searchParams.set("state", state);

        // Enforce Instagram Login
        authUrl.searchParams.set("enable_fb_login", "0");
        authUrl.searchParams.set("force_authentication", "1");

        console.info(`[IG CONNECT] Redirecting to ${authUrl.origin}${authUrl.pathname}`);
        console.info(`[IG CONNECT] Params: client_id=${env.INSTAGRAM_CLIENT_ID}, scope='...', state_prefix=${state.substring(0, 10)}...`);

        const response = NextResponse.redirect(authUrl.toString(), { status: 302 });

        // CSRF Cookie
        response.cookies.set("ig_oauth_nonce", nonce, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 600,
            sameSite: 'lax'
        });

        return response;

    } catch (e: any) {
        console.error("[IG CONNECT ERROR]", e);
        return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(e.message || 'Erro de configuração')}`, appUrl), { status: 302 });
    }
}
