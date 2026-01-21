import { NextResponse } from "next/server";
import crypto from "crypto";
import { getEnv, getAppUrl } from "@/lib/env";

export const dynamic = 'force-dynamic'; // Ensure envs are read at runtime

// Helper helpers
function base64url(input: string) {
    return Buffer.from(input).toString("base64url");
}

function createState(secret: string, nonce: string) {
    const now = Date.now();
    const payload = {
        nonce: nonce,
        iat: now,
        exp: now + 10 * 60 * 1000,
        next: "/settings?tab=integracoes"
    };
    const body = base64url(JSON.stringify(payload));
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${sig}`;
}

export async function GET(req: Request) {
    try {
        // 1. Read Envs (Runtime)
        const clientId = getEnv("INSTAGRAM_CLIENT_ID");
        const redirectUriRaw = getEnv("INSTAGRAM_REDIRECT_URI");
        const authStateSecret = getEnv("AUTH_STATE_SECRET");

        // Validate redirect URI format
        if (!redirectUriRaw.startsWith("https://")) {
            throw new Error(`INSTAGRAM_REDIRECT_URI deve iniciar com https://. Valor: ${redirectUriRaw}`);
        }
        const redirectUri = redirectUriRaw; // already trimmed by getEnv

        // 2. Log Debug Info (Safe)
        console.log("[IG CONNECT] Starting flow");
        console.log(`[IG CONNECT] redirect_uri=${redirectUri}`);
        console.log(`[IG CONNECT] client_id_present=${!!clientId}`);

        // 3. Generate State
        const nonce = crypto.randomBytes(16).toString("hex");
        const state = createState(authStateSecret, nonce);

        console.log(`[IG CONNECT] state_prefix=${state.substring(0, 10)}...`);

        // 4. Build Official Instagram OAuth URL
        // https://www.instagram.com/oauth/authorize
        const authUrl = new URL("https://www.instagram.com/oauth/authorize");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", "instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages");
        authUrl.searchParams.set("state", state);
        // Optional: force_authentication=1 ensures user can switch accounts
        // authUrl.searchParams.set("force_authentication", "1"); 

        // 5. Redirect
        const response = NextResponse.redirect(authUrl.toString(), { status: 302 });

        // Store nonce to prevent CSRF
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
        // Send error to UI
        return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(e.message || 'Erro de configuração')}`, appUrl), { status: 302 });
    }
}
