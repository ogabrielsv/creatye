import { NextResponse } from "next/server";
import crypto from "crypto";

// Minimal helpers for secure state
function base64url(input: string) {
    return Buffer.from(input).toString("base64url");
}
function uuidv4() {
    return crypto.randomUUID();
}
function createState(secret: string) {
    const now = Date.now();
    // State payload includes nonce, expiration, and next path
    const payload = {
        nonce: crypto.randomBytes(16).toString("hex"),
        iat: now,
        exp: now + 10 * 60 * 1000,
        next: "/settings"
    };
    const body = base64url(JSON.stringify(payload));
    // HMAC signature to prevent tampering
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${sig}`;
}

export async function GET(req: Request) {
    const url = new URL(req.url);

    // Read env vars
    const appUrl = process.env.APP_URL || url.origin;
    const clientId = process.env.IG_BIZ_CLIENT_ID;
    const redirectUri = process.env.IG_BIZ_REDIRECT_URI;
    const stateSecret = process.env.AUTH_STATE_SECRET;

    // Fail fast if config is missing
    if (!clientId || !redirectUri || !stateSecret) {
        console.error("Missing IG business env vars: check IG_BIZ_CLIENT_ID, IG_BIZ_REDIRECT_URI, AUTH_STATE_SECRET");
        return NextResponse.redirect(new URL("/settings?error=Falha+ao+iniciar+login", appUrl), { status: 302 });
    }

    // Construct the JSON params for the consent flow
    // Scopes requested: Basic, Comments, Messages (for full automations)
    const params = {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        state: createState(stateSecret),
        scope: "instagram_business_basic-instagram_business_manage_comments-instagram_business_manage_messages",
        logger_id: uuidv4(),
        app_id: clientId,
        platform_app_id: clientId
    };

    // Build the consent URL
    const consent = new URL("https://www.instagram.com/consent/");
    consent.searchParams.set("flow", "ig_biz_login_oauth");
    consent.searchParams.set("params_json", JSON.stringify(params));
    consent.searchParams.set("source", "oauth_permissions_page_www");

    // Redirect user to Instagram Consent
    return NextResponse.redirect(consent.toString(), { status: 302 });
}
