import { NextResponse } from "next/server";
import crypto from "crypto";

function base64url(input: Buffer | string) {
    return Buffer.from(input).toString("base64url");
}

function createSignedState(payload: any, secret: string) {
    const body = base64url(JSON.stringify(payload));
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${sig}`;
}

export async function GET(req: Request) {
    const url = new URL(req.url);

    const clientId = process.env.INSTAGRAM_CLIENT_ID!;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI!;
    const stateSecret = process.env.AUTH_STATE_SECRET!;
    const appUrl = process.env.APP_URL || url.origin;

    if (!clientId || !redirectUri || !stateSecret) {
        console.error("Missing Instagram env vars");
        return NextResponse.redirect(new URL("/settings?error=Falha+ao+iniciar+login", appUrl), { status: 302 });
    }

    const now = Date.now();
    const payload = {
        nonce: crypto.randomBytes(16).toString("hex"),
        iat: now,
        exp: now + 10 * 60 * 1000
    };

    const state = createSignedState(payload, stateSecret);

    const auth = new URL("https://www.instagram.com/oauth/authorize");
    auth.searchParams.set("client_id", clientId);
    auth.searchParams.set("redirect_uri", redirectUri);
    auth.searchParams.set("scope", "user_profile,user_media");
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("state", state);
    auth.searchParams.set("force_authentication", "1");

    return NextResponse.redirect(auth.toString(), { status: 302 });
}
