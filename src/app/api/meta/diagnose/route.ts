import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const appId = (process.env.META_APP_ID || '').trim();
    const appSecret = (process.env.META_APP_SECRET || '').trim();
    const redirectUri = (process.env.META_REDIRECT_URI || '').trim();

    // Check formats without revealing secrets
    const secretFormatOk = /^[a-f0-9]{32}$/i.test(appSecret);
    const appIdFormatOk = /^\d{10,}$/.test(appId);
    const redirectUriFormatOk = redirectUri.startsWith('https://') && redirectUri.includes('/api/meta/callback');

    return NextResponse.json({
        ok: appIdFormatOk && secretFormatOk && redirectUriFormatOk,
        meta_app_id_present: !!appId,
        meta_app_id_format_ok: appIdFormatOk,
        meta_app_secret_present: !!appSecret,
        meta_app_secret_format_ok: secretFormatOk,
        meta_redirect_uri_present: !!redirectUri,
        meta_redirect_uri_value: redirectUri,
        meta_redirect_uri_format_ok: redirectUriFormatOk,
        node_env: process.env.NODE_ENV
    });
}
