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
        const clientId = getEnv("INSTAGRAM_CLIENT_ID");
        const clientSecret = getEnv("INSTAGRAM_CLIENT_SECRET");
        const redirectUriRaw = getEnv("INSTAGRAM_REDIRECT_URI");
        const authStateSecret = getEnv("AUTH_STATE_SECRET");

        const redirectUri = redirectUriRaw;

        if (!code || !state) throw new Error("Missing code or state");

        // Verify State
        const payload = verifyState(state, authStateSecret);

        const cookies = req.headers.get("cookie");
        const nonceCookie = cookies?.split(';').find(c => c.trim().startsWith('ig_oauth_nonce='))?.split('=')[1];

        if (!nonceCookie || nonceCookie !== payload.nonce) {
            throw new Error("Nonce mismatch (CSRF detected)");
        }

        console.log(`[IG CALLBACK] swapping code. redirect_uri=${redirectUri}`);

        // Token Exchange
        // https://api.instagram.com/oauth/access_token
        const tokenEndpoint = "https://api.instagram.com/oauth/access_token";

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
            console.error("[IG CALLBACK] Token exchange failed:", tokenRes.status, JSON.stringify(tokenJson));
            throw new Error(`Falha ao obter token: ${tokenJson.error_message || tokenJson.error?.message || 'Erro desconhecido'}`);
        }

        const accessToken = tokenJson.access_token;
        const igUserId = tokenJson.user_id;

        // Persist
        const { createClient } = await import('@/lib/supabase/server');
        const sessionSupabase = await createClient();
        const { data: { user: sessionUser } } = await sessionSupabase.auth.getUser();

        if (!sessionUser) {
            throw new Error("Usuário não logado");
        }

        const supabaseAdmin = createServerClient();

        // Save Account
        const { error: upsertError } = await supabaseAdmin
            .from('instagram_accounts')
            .upsert({
                user_id: sessionUser.id,
                ig_user_id: igUserId?.toString() || 'unknown',
                access_token: accessToken,
                connected_at: new Date().toISOString(),
                status: 'connected',
                last_sync_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (upsertError) {
            console.error("[IG CALLBACK] DB Save Error:", upsertError);
            throw new Error("Falha ao salvar no banco");
        }

        // Log Success
        await supabaseAdmin.from('automation_logs').insert({
            user_id: sessionUser.id,
            level: 'info',
            message: 'Instagram conectado com sucesso',
            meta: { ig_user_id: igUserId, timestamp: new Date().toISOString() }
        });

        const response = NextResponse.redirect(new URL("/settings?tab=integracoes&success=1", appUrl), { status: 302 });
        response.cookies.delete("ig_oauth_nonce");
        return response;

    } catch (e: any) {
        console.error("[IG CALLBACK ERROR]", e);
        return NextResponse.redirect(new URL(`/settings?tab=integracoes&error=${encodeURIComponent(e.message || 'Falha no callback')}`, appUrl), { status: 302 });
    }
}
