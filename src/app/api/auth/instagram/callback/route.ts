import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServerClient } from "@/lib/supabase/server-admin";

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

    const appUrl = process.env.APP_URL || url.origin;

    // Clean vars
    const clientId = process.env.IG_BIZ_CLIENT_ID!;
    const clientSecret = process.env.IG_BIZ_CLIENT_SECRET!;
    const redirectUri = process.env.IG_BIZ_REDIRECT_URI!;
    const stateSecret = process.env.AUTH_STATE_SECRET!;

    // Handle provider errors
    if (errorParam) {
        console.error("Callback provider error:", errorParam);
        return NextResponse.redirect(new URL(`/settings?error=Erro+do+Instagram:${errorParam}`, appUrl), { status: 302 });
    }

    try {
        if (!code || !state) throw new Error("Missing code or state");

        // 2. Verify State
        const payload = verifyState(state, stateSecret);

        // 3. Exchange code for access token (Graph API for Business)
        const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
        tokenUrl.searchParams.set("client_id", clientId);
        tokenUrl.searchParams.set("client_secret", clientSecret);
        tokenUrl.searchParams.set("redirect_uri", redirectUri);
        tokenUrl.searchParams.set("code", code);

        const tokenRes = await fetch(tokenUrl.toString(), { method: "GET" });
        const tokenJson = await tokenRes.json();

        if (!tokenRes.ok || tokenJson.error) {
            console.error("Token exchange failed:", tokenJson);
            throw new Error("Falha na troca de token");
        }

        const accessToken = tokenJson.access_token;
        // Note: tokenJson might contain 'expires_in'. For FB Graph, access tokens are usually LLT (approx 60 days) if exchanged this way

        // 4. Get User & Account Details (We need to find the Instagram Business Account ID)
        // We query /me/accounts to get Pages -> IG Business Account
        const pagesRes = await fetch(
            `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${accessToken}`
        );
        const pagesData = await pagesRes.json();

        if (pagesData.error) throw new Error("Erro ao buscar páginas: " + pagesData.error.message);

        let connectedAccount = null;
        // Find the first page with a connected IG business account
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

        // 5. Persist in Database (using Service Role)
        const supabase = createServerClient();
        // We don't have the internal user_id in the state payload in the 'connect' route example above, 
        // but typically we should. 
        // For now, let's assume we can get it from the current session or rely on the state if we added it.
        // Let's refetch session to be safe.
        // IMPORTANT: 'createServerClient' (the one we imported) uses Service Role, so it doesn't represent a logged-in user session by default unless we pass cookies. 
        // Let's try to get the user from the supabase-js auth (if cookies are passed) OR if we can't, 
        // we should have embedded `userId` in the `createState` function in `connect/route.ts`. 
        // Looking at the provided `connect` code, it didn't include `userId`. 
        // This is a common pitfall. Let's fix it: The User will be logged in on the browser, so we can try valid session check. 

        // We will verify session via standard means for now.
        // If that fails, we can't link. 
        // BUT we are in a 'callback' route, cookies should be present.

        // Let's assume we can get the user via headers/cookies.
        // However, clean architecture suggests `createServerClient` is admin.
        // Let's use `auth.getUser()` with the incoming request cookies if possible, or just fail for now if we can't key it.
        // The prompt implementation of state didn't preserve userId. I'll stick to expected behavior:
        // We need to link to a user. Best effort:
        // (In a real app, pass userId in state).

        // Since I can't edit `connect/route.ts` again in this same step to add userId without losing focus,
        // I will try to get the user from the session.

        // NOTE: This assumes Supabase Auth cookies are set and valid on the domain.
        const { data: { user } } = await supabase.auth.getUser();
        // Actually `createServerClient` in `server-admin.ts` (from previous context) might not read cookies by default if it's pure admin.
        // If `auth.getUser()` returns null, we have a problem.
        // But let's proceed assuming the user is logged in (session cookie).
        // If not, we throw.

        // Wait, `createServerClient` as defind in previous turns (admin) usually does NOT read cookies.
        // We should use the standard `createClient` from `@/lib/supabase/server` to get the user, then admin to write.

        // Let's try to import the session client.
        const { createClient: createSessionClient } = await import('@/lib/supabase/server');
        const sessionSupabase = await createSessionClient();
        const { data: { user: sessionUser } } = await sessionSupabase.auth.getUser();

        if (!sessionUser) {
            throw new Error("Usuário não autenticado no callback");
        }

        // Update DB
        const { error: upsertError } = await supabase
            .from('instagram_accounts')
            .upsert({
                user_id: sessionUser.id,
                ig_user_id: connectedAccount.igUserId,
                ig_username: connectedAccount.username,
                access_token: connectedAccount.pageAccessToken, // Prefer page token for business features
                page_id: connectedAccount.pageId,
                connected_at: new Date().toISOString(),
                status: 'connected',
                last_sync_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (upsertError) {
            console.error("DB Upsert Error:", upsertError);
            throw new Error("Falha ao salvar conta");
        }

        // Redirect Success
        const nextPath = payload.next || "/settings";
        return NextResponse.redirect(new URL(`${nextPath}?tab=integracoes&ig=connected`, appUrl), { status: 302 });

    } catch (err: any) {
        console.error("Callback critical error:", err);
        return NextResponse.redirect(new URL("/settings?tab=integracoes&error=Falha+no+callback", appUrl), { status: 302 });
    }
}
