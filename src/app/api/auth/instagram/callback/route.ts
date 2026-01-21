import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServerClient } from "@/lib/supabase/server-admin";
import { getServerEnv, getInstagramRedirectUri } from "@/lib/env";

// 1. Helper to verify signed state
function verifyState(state: string, secret: string) {
    const [body, sig] = state.split(".");
    if (!body || !sig) throw new Error("Invalid state format");
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    if (sig !== expected) throw new Error("Invalid state signature");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (Date.now() > payload.exp) throw new Error("State expired");
    return payload;
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    // Cookie check
    const cookies = req.headers.get("cookie");
    const nonceCookie = cookies?.split(';').find(c => c.trim().startsWith('ig_oauth_nonce='))?.split('=')[1];

    const env = getServerEnv();
    const appUrl = env.APP_URL || url.origin; // fallback

    // Handle provider errors
    if (errorParam) {
        console.error("Callback provider error:", errorParam);
        return NextResponse.redirect(new URL(`/settings?error=Erro+do+Instagram:${errorParam}`, appUrl), { status: 302 });
    }

    try {
        if (!code || !state) throw new Error("Missing code or state");

        // 2. Verify State & Nonce
        const payload = verifyState(state, env.AUTH_STATE_SECRET);

        if (!nonceCookie || nonceCookie !== payload.nonce) {
            throw new Error("Nonce mismatch (CSRF detected)");
        }

        // 3. Exchange code for access token (Graph API for Business)
        const redirectUri = getInstagramRedirectUri();
        console.log("[IG CALLBACK] Exchanging token. Params:");
        console.log(" - Client ID present:", !!env.INSTAGRAM_CLIENT_ID);
        console.log(" - Redirect URI:", redirectUri);

        if (!redirectUri.startsWith("http")) {
            throw new Error("Redirect URI must be absolute");
        }

        const body = new URLSearchParams();
        body.set("client_id", env.INSTAGRAM_CLIENT_ID);
        body.set("client_secret", env.INSTAGRAM_CLIENT_SECRET);
        body.set("grant_type", "authorization_code");
        body.set("redirect_uri", redirectUri);
        body.set("code", code);

        const tokenRes = await fetch("https://graph.facebook.com/v19.0/oauth/access_token", {
            method: "POST",
            body: body
        });

        const tokenJson = await tokenRes.json();

        if (!tokenRes.ok || tokenJson.error) {
            console.error("Token exchange failed:", tokenJson);
            throw new Error(`Falha na troca de token: ${tokenJson.error?.message || 'Erro desconhecido'}`);
        }

        const accessToken = tokenJson.access_token;

        // 4. Get User & Account Details
        // We query /me/accounts to get Pages -> IG Business Account
        const pagesRes = await fetch(
            `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${accessToken}`
        );
        const pagesData = await pagesRes.json();

        if (pagesData.error) throw new Error("Erro ao buscar páginas: " + pagesData.error.message);

        let connectedAccount = null;
        if (pagesData.data && Array.isArray(pagesData.data)) {
            for (const page of pagesData.data) {
                if (page.instagram_business_account?.id) {
                    connectedAccount = {
                        pageId: page.id,
                        pageAccessToken: page.access_token, // Page-scoped token for DMs
                        igUserId: page.instagram_business_account.id,
                        username: page.instagram_business_account.username
                    };
                    break;
                }
            }
        }

        if (!connectedAccount) {
            throw new Error("Nenhuma conta Instagram Business conectada encontrada.");
        }

        // 5. Persist in Database
        // We need to link with the logged in user.
        const { createClient } = await import('@/lib/supabase/server');
        const sessionSupabase = await createClient();
        const { data: { user: sessionUser } } = await sessionSupabase.auth.getUser();

        if (!sessionUser) {
            throw new Error("Usuário não autenticado no callback");
        }

        const supabaseAdmin = createServerClient();

        // Update DB
        const { error: upsertError } = await supabaseAdmin
            .from('instagram_accounts')
            .upsert({
                user_id: sessionUser.id,
                ig_user_id: connectedAccount.igUserId,
                ig_username: connectedAccount.username,
                access_token: connectedAccount.pageAccessToken, // Prefer page token
                page_id: connectedAccount.pageId,
                connected_at: new Date().toISOString(),
                status: 'connected',
                last_sync_at: new Date().toISOString()
            }, { onConflict: 'user_id' }); // We enforce 1 IG account per user for now

        if (upsertError) {
            console.error("DB Upsert Error:", upsertError);
            throw new Error("Falha ao salvar conta");
        }

        // Redirect Success
        const nextPath = payload.next || "/settings?tab=integracoes";
        const response = NextResponse.redirect(new URL(`${nextPath}&success=1`, appUrl), { status: 302 });

        // Clear nonce cookie
        response.cookies.delete("ig_oauth_nonce");

        return response;

    } catch (err: any) {
        console.error("[IG CALLBACK CRITICAL]", err);
        return NextResponse.redirect(new URL("/settings?tab=integracoes&error=Falha+no+callback", appUrl), { status: 302 });
    }
}
