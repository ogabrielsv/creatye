import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServerClient } from "@/lib/supabase/server-admin";
import { getServerEnv } from "@/lib/env";
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    const env = getServerEnv();
    const appUrl = env.APP_URL;

    // 1. Handle Provider Errors
    if (errorParam || errorReason) {
        console.error("[IG CALLBACK] Provider Error:", errorParam, errorReason, errorDescription);
        return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(errorDescription || errorParam || 'Erro do Instagram')}`, appUrl), { status: 302 });
    }

    try {
        if (!code || !state) throw new Error("Missing code or state");

        // Verify State
        const payload = verifyState(state, env.AUTH_STATE_SECRET);

        const cookies = req.headers.get("cookie");
        const nonceCookie = cookies?.split(';').find(c => c.trim().startsWith('ig_oauth_nonce='))?.split('=')[1];

        if (!nonceCookie || nonceCookie !== payload.nonce) {
            throw new Error("Nonce mismatch (CSRF detected)");
        }

        console.info(`[IG CALLBACK] swapping code. redirect_uri=${env.INSTAGRAM_REDIRECT_URI}`);

        // Token Exchange
        const tokenEndpoint = "https://api.instagram.com/oauth/access_token";
        const body = new URLSearchParams();
        body.set("client_id", env.INSTAGRAM_CLIENT_ID);
        body.set("client_secret", env.INSTAGRAM_CLIENT_SECRET);
        body.set("grant_type", "authorization_code");
        body.set("redirect_uri", env.INSTAGRAM_REDIRECT_URI);
        body.set("code", code);

        const tokenRes = await fetch(tokenEndpoint, {
            method: "POST",
            body: body,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const tokenJson = await tokenRes.json();

        if (!tokenRes.ok) {
            console.error("[IG TOKEN] Token exchange failed:", tokenRes.status, JSON.stringify(tokenJson));
            throw new Error(`Falha ao obter token: ${tokenJson.error_message || tokenJson.error?.message || 'Erro desconhecido'}`);
        }

        const accessToken = tokenJson.access_token;
        const igUserId = tokenJson.user_id;

        // Fetch User Profile (username)
        let username = "unknown";
        try {
            const profileRes = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`);
            if (profileRes.ok) {
                const profile = await profileRes.json();
                if (profile.username) username = profile.username;
            } else {
                console.warn("[IG CALLBACK] Failed to fetch profile", await profileRes.text());
            }
        } catch (err) {
            console.error("[IG CALLBACK] Profile fetch error", err);
        }

        console.info(`[IG CALLBACK] token_received user_id=${igUserId}`);

        // Persist
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
                ig_user_id: igUserId.toString(),
                username: username,
                access_token: accessToken,
                token_type: 'bearer',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: 'connected'
            }, { onConflict: 'user_id,ig_user_id' }); // Conflict on composite key if strict, or just user_id if 1 account per user? 
        // The unique constraint is (user_id, ig_user_id).
        // But user might want multiple accounts? 
        // The prompt says: "usar UPSERT por (user_id, ig_user_id)"

        if (upsertError) {
            console.error("[IG CALLBACK] DB Save Error:", upsertError);
            throw new Error("Falha ao salvar conta");
        }

        // Log to automation_logs
        await supabaseAdmin.from('automation_logs').insert({
            user_id: sessionUser.id,
            level: 'info',
            message: 'Conta do Instagram conectada com sucesso',
            meta: {
                phase: 'callback',
                ig_user_id: igUserId,
                username: username
            },
            created_at: new Date().toISOString()
        });

        const nextUrl = payload.next || "/dashboard";
        const response = NextResponse.redirect(new URL(nextUrl, appUrl), { status: 302 });
        response.cookies.delete("ig_oauth_nonce");
        return response;

    } catch (e: any) {
        console.error("[IG CALLBACK ERROR]", e);
        return NextResponse.redirect(new URL(`/settings?tab=integracoes&error=${encodeURIComponent(e.message || 'Falha no callback')}`, appUrl), { status: 302 });
    }
}
