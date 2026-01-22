import { NextRequest, NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { createServerClient } from '@/lib/supabase/server-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: Webhook Verification
export async function GET(req: NextRequest) {
    const env = getServerEnv();
    const { searchParams } = new URL(req.url);

    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
        console.info(`[WEBHOOK] Verified challenge: ${challenge}`);
        return new NextResponse(challenge, { status: 200 });
    }

    console.warn(`[WEBHOOK] Verification failed. Mode: ${mode}, Token: ${token}`);
    return new NextResponse('Forbidden', { status: 403 });
}

// POST: Receive Events
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const object = body.object;

        console.info(`[WEBHOOK] Received event: ${object}`);

        if (object === 'instagram' || object === 'page') {
            // Log payload snippet
            // const snippet = JSON.stringify(body).substring(0, 100);
            // console.info(`[WEBHOOK] Payload: ${snippet}...`);

            const supabase = createServerClient();

            // Save to webhook_events for async processing
            const { error } = await supabase.from('webhook_events').insert({
                payload: body,
                received_at: new Date().toISOString()
            });

            if (error) {
                console.error('[WEBHOOK] Failed to save event:', error);
                return new NextResponse('Internal Server Error', { status: 500 });
            }

            console.info('[WEBHOOK] Event saved to queue.');
            return new NextResponse('EVENT_RECEIVED', { status: 200 });
        }

        return new NextResponse('Not Found', { status: 404 });

    } catch (e: any) {
        console.error('[WEBHOOK] Error processing POST:', e);
        return new NextResponse('Server Error', { status: 500 });
    }
}
