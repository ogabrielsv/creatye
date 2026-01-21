import { NextResponse } from "next/server";
import crypto from "crypto";
import { validateInstagramEnv, IG_CLIENT_ID, IG_REDIRECT_URI, AUTH_STATE_SECRET } from "@/lib/env";

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
    const url = new URL(req.url);

    try {
        validateInstagramEnv();

        console.log("[IG CONNECT] Starting flow");
        console.log("[IG CONNECT] Client ID (last 4):", IG_CLIENT_ID.slice(-4));
        console.log("[IG CONNECT] Redirect URI:", IG_REDIRECT_URI);

        // Generate Nonce
        const nonce = crypto.randomBytes(16).toString("hex");

        // Construct the JSON params for the consent flow
        // Scopes requested: Basic, Comments, Messages (for full automations)
        const params = {
            client_id: IG_CLIENT_ID,
            redirect_uri: IG_REDIRECT_URI,
            response_type: "code",
            state: createState(AUTH_STATE_SECRET, nonce),
            scope: "instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages", // Commas or spaces work, but let's stick to standard params_json format which wraps this object. The actual consent expects comma separated in json or space separated in standard oauth. JSON params usually handles list or string. Let's send list string.
            // Actually, Instagram Biz Login via params_json: scope should be a comma-separated string inside the JSON object
            logger_id: uuidv4(),
            app_id: IG_CLIENT_ID,
            platform_app_id: IG_CLIENT_ID
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
        return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(e.message || 'Erro config')}`, appUrl), { status: 302 });
    }
}
