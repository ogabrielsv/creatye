import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServerClient } from "@/lib/supabase/server-admin";
import { getEnv, getAppUrl } from "@/lib/env";

export const dynamic = 'force-dynamic';

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
    const errorReason = url.searchParams.get("error_reason");
    const errorDescription = url.searchParams.get("error_description");

    const appUrl = getAppUrl();

    // 1. Handle Provider Errors
    if (errorParam || errorReason) {
        console.error("[IG CALLBACK] Provider Error:", errorParam, errorReason, errorDescription);
        return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(errorDescription || errorParam || 'Erro do Instagram')}`, appUrl), { status: 302 });
    }

    try {
        // 2. Read Envs (Runtime)
        const clientId = getEnv("INSTAGRAM_CLIENT_ID");
        const clientSecret = getEnv("INSTAGRAM_CLIENT_SECRET");
        const redirectUriRaw = getEnv("INSTAGRAM_REDIRECT_URI");
        const authStateSecret = getEnv("AUTH_STATE_SECRET");

        const redirectUri = redirectUriRaw; // getEnv trims it

        if (!code || !state) throw new Error("Missing code or state");

        // 3. Verify State & Nonce
        const payload = verifyState(state, authStateSecret);

        const cookies = req.headers.get("cookie");
        const nonceCookie = cookies?.split(';').find(c => c.trim().startsWith('ig_oauth_nonce='))?.split('=')[1];

        if (!nonceCookie || nonceCookie !== payload.nonce) {
            throw new Error("Nonce mismatch (CSRF detected)");
        }

        // 4. Exchange Code for Token
        console.log(`[IG CALLBACK] exchanging token redirect_uri=${redirectUri} client_id_present=${!!clientId}`);

        // Use api.instagram.com for Instagram Login code exchange
        const tokenEndpoint = "https://api.instagram.com/oauth/access_token"; // Official matching endpoint for instagram.com/oauth/authorize
        // Note: For Business scopes, sometimes graph.facebook.com is needed, but let's try strict pair first.
        // If the user gets permissions but fails here, it might be the endpoint. 
        // IF this logic fails for "business" scopes, we might need to swap to graph.facebook.com.
        // However, prompt asked for "official token endpoint" pairing to standard oauth. 
        // Standard IG OAuth -> api.instagram.com.
        // BUT `instagram_business_manage_messages` is a GRAPH API scope.
        // Let's stick to the prompt's implied "Connect Direct" logic. If validation fails, we swap.
        // Actually, many successful implementations use graph.facebook.com even with instagram.com authorize for Business. 
        // Let's use `api.instagram.com` first as it's safer for "Instagram Login" flow logic.

        const body = new URLSearchParams();
        body.set("client_id", clientId);
        body.set("client_secret", clientSecret);
        body.set("grant_type", "authorization_code");
        body.set("redirect_uri", redirectUri);
        body.set("code", code);

        const tokenRes = await fetch(tokenEndpoint, {
            method: "POST",
            body: body
        });

        const tokenJson = await tokenRes.json();

        if (!tokenRes.ok) {
            console.error("[IG CALLBACK] Token exchange failed. Status:", tokenRes.status);
            console.error("[IG CALLBACK] Body:", JSON.stringify(tokenJson));
            if (tokenJson.error?.fbtrace_id) {
                console.error("[IG CALLBACK] fbtrace_id:", tokenJson.error.fbtrace_id);
            }
            throw new Error(`Falha na troca de token: ${tokenJson.error_message || tokenJson.error?.message || 'Erro desconhecido'}`);
        }

        const accessToken = tokenJson.access_token;
        const igUserId = tokenJson.user_id; // Basic Display returns this

        // 5. Persist Connection
        // Need to identify user. Assuming session cookie exists.
        const { createClient } = await import('@/lib/supabase/server');
        const sessionSupabase = await createClient();
        const { data: { user: sessionUser } } = await sessionSupabase.auth.getUser();

        if (!sessionUser) {
            throw new Error("Usuário não logado no callback");
        }

        // We might need to fetch the username if Basic Display.
        // Or if it's Business, we might need to query Graph.
        // Let's assume Basic Display response shape for now based on endpoint.
        // Fetch User node
        // If scopes are business, we might have issues querying Graph with a Basic token?
        // Actually, `instagram.com` + `api.instagram.com` returns a "short lived Instagram User Token".
        // It might NOT work for `instagram_business_manage_messages`.
        // If this fails (permissions error), the user fundamentally needs "Facebook Login" but styled as Instagram.
        // But let's follow the "DIRECT LOGIN" requirement.

        // Upsert to DB
        const supabaseAdmin = createServerClient();

        // We'll upsert what we have.
        const { error: upsertError } = await supabaseAdmin
            .from('instagram_accounts')
            .upsert({
                user_id: sessionUser.id,
                ig_user_id: igUserId?.toString() || 'unknown',
                access_token: accessToken,
                // We'll try to sync profile later or here if simple
                connected_at: new Date().toISOString(),
                status: 'connected',
                last_sync_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (upsertError) {
            console.error("[IG CALLBACK] DB Save Error:", upsertError);
            throw new Error("Falha ao salvar no banco");
        }

        // Success Redirect
        const response = NextResponse.redirect(new URL("/settings?tab=integracoes&success=1", appUrl), { status: 302 });
        response.cookies.delete("ig_oauth_nonce");
        return response;

    } catch (e: any) {
        console.error("[IG CALLBACK ERROR]", e);
        return NextResponse.redirect(new URL(`/settings?tab=integracoes&error=${encodeURIComponent(e.message || 'Falha no callback')}`, appUrl), { status: 302 });
    }
}
