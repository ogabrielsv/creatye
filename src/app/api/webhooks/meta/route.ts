import { NextRequest, NextResponse } from 'next/server';
import { processInstagramMessage } from '@/lib/automations/processor';
import { getEnv } from '@/lib/env';

export async function GET(req: NextRequest) {
    // Verification Challenge for Meta Webhooks
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // Use standardized env var
    const verifyToken = getEnv('INSTAGRAM_WEBHOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken) {
        return new NextResponse(challenge, { status: 200 });
    }

    return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Log for debugging
        // console.log('Webhook Received:', JSON.stringify(body, null, 2));

        if (body.object === 'instagram' && body.entry) {
            for (const entry of body.entry) {
                if (entry.messaging) {
                    // Process all messaging events in parallel or sequential? 
                    // Use Promise.all if high volume, but sequential is safer for ordering.
                    // Given this is a simple implementation, Promise.all is fine but identifying order matters for conversation.
                    // For now, let's just await each.
                    for (const event of entry.messaging) {
                        try {
                            await processInstagramMessage(event);
                        } catch (e) {
                            console.error('Error processing event:', event, e);
                        }
                    }
                }
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
