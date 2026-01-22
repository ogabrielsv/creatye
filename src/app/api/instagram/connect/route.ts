import { NextResponse } from "next/server";
import crypto from "crypto";
import { getEnv, getAppUrl } from "@/lib/env";

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
    try {
        console.info("[IG CONNECT] Starting flow");

        const clientId = getEnv("INSTAGRAM_CLIENT_ID");
        const redirectUriRaw = getEnv("INSTAGRAM_REDIRECT_URI");
        const authStateSecret = getEnv("AUTH_STATE_SECRET");

        // Validate redirect URI
        if (!redirectUriRaw.startsWith("https://")) {
            throw new Error(`INSTAGRAM_REDIRECT_URI deve iniciar com https://. Valor: ${redirectUriRaw}`);
        }
        const redirectUri = redirectUriRaw;

        console.info(`[IG CONNECT] redirect_uri=${redirectUri}`);

        // Generate State
        const nonce = crypto.randomBytes(16).toString("hex");
        const state = createState(authStateSecret, nonce);

        // Build Official Instagram OAuth URL (Direct Login)
        // https://www.instagram.com/oauth/authorize
        // NO enable_fb_login, NO force_authentication as per instruction 1 task B
        const authUrl = new URL("https://www.instagram.com/oauth/authorize");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        // Using standard business scopes
        authUrl.searchParams.set("scope", "instagram_business_basic,instagram_manage_comments,instagram_business_manage_messages");
        authUrl.searchParams.set("state", state);

        console.info(`[IG CONNECT] Redirecting to ${authUrl.origin}${authUrl.pathname}`);

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
        const appUrl = getAppUrl();
        return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(e.message || 'Erro de configuração')}`, appUrl), { status: 302 });
    }
}
