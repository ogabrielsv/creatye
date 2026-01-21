import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerEnv, getInstagramRedirectUri, EnvError } from "@/lib/env";

// Minimal helpers for secure state
function base64url(input: string) {
    return Buffer.from(input).toString("base64url");
}
function uuidv4() {
    return crypto.randomUUID();
}
function createState(secret: string, nonce: string) {
    const now = Date.now();
    // State payload includes nonce, expiration, and next path
    const payload = {
        nonce: nonce,
        iat: now,
        exp: now + 10 * 60 * 1000,
        next: "/settings?tab=integracoes"
    };
    const body = base64url(JSON.stringify(payload));
    // HMAC signature to prevent tampering
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${sig}`;
}

export async function GET(req: Request) {
    const url = new URL(req.url); // for origin fallback if needed

    try {
        const env = getServerEnv();
        const redirectUri = getInstagramRedirectUri();

        console.log("[IG CONNECT] Starting flow");
        console.log("[IG CONNECT] Client ID present:", !!env.INSTAGRAM_CLIENT_ID);
        console.log("[IG CONNECT] Redirect URI:", redirectUri);

        if (!env.INSTAGRAM_CLIENT_ID || !env.AUTH_STATE_SECRET) {
            throw new EnvError("Configurações do Instagram incompletas.");
        }

        // Generate Nonce
        const nonce = crypto.randomBytes(16).toString("hex");

        // Construct the JSON params for the consent flow
        // Scopes requested: Basic, Comments, Messages (for full automations)
        const params = {
            client_id: env.INSTAGRAM_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: "code",
            state: createState(env.AUTH_STATE_SECRET, nonce),
            scope: "instagram_business_basic-instagram_business_manage_comments-instagram_business_manage_messages",
            logger_id: uuidv4(),
            app_id: env.INSTAGRAM_CLIENT_ID,
            platform_app_id: env.INSTAGRAM_CLIENT_ID
        };

        // Build the consent URL
        const consent = new URL("https://www.instagram.com/consent/");
        consent.searchParams.set("flow", "ig_biz_login_oauth");
        consent.searchParams.set("params_json", JSON.stringify(params));
        consent.searchParams.set("source", "oauth_permissions_page_www");

        // Redirect user to Instagram Consent
        const response = NextResponse.redirect(consent.toString(), { status: 302 });

        // Store nonce in httpOnly cookie to prevent replay/CSRF
        response.cookies.set("ig_oauth_nonce", nonce, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 600, // 10 min matches state exp
            sameSite: 'lax'
        });

        return response;

    } catch (e: any) {
        console.error("[IG CONNECT ERROR]", e);
        const appUrl = process.env.APP_URL || url.origin;
        return NextResponse.redirect(new URL("/settings?error=Falha+configuracao", appUrl), { status: 302 });
    }
}
