import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendInstagramDM } from '@/lib/instagram/messenger'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED')
            return new NextResponse(challenge, { status: 200 })
        } else {
            return new NextResponse('Forbidden', { status: 403 })
        }
    }

    return new NextResponse('Bad Request', { status: 400 })
}

import { processIncomingMessage } from '@/lib/services/automation-runner';

// ... (GET handler remains same) ...

export async function POST(request: Request) {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('[FATAL] SUPABASE_SERVICE_ROLE_KEY is missing');
            return new NextResponse('Server Config Error', { status: 500 });
        }

        const body = await request.json()

        // Log controlled snippet
        const payloadSnippet = JSON.stringify(body).slice(0, 4000);
        console.log("[WEBHOOK] payload_snippet=", payloadSnippet);

        if (body.object === 'instagram') {
            // Use the new supabaseAdmin client
            const { supabaseAdmin } = await import('@/lib/supabaseAdmin');

            for (const entry of body.entry) {
                // Log Entry Summary
                const keys = Object.keys(entry);
                console.log(`[WEBHOOK] Entry ID=${entry.id} Keys=${keys.join(',')}`);

                // 1) Handle Messaging (DMs)
                if (entry.messaging) {
                    for (const event of entry.messaging) {
                        // 6. Loop Protection
                        if (event.message?.is_echo) {
                            console.log('[DM_EVENT] Ignored (is_echo=true)');
                            continue;
                        }
                        // Also ignore if it is a delivery or read receipt (though usually those don't have 'message' field in the same way, but explicit check is good)
                        if (event.delivery || event.read) {
                            continue;
                        }

                        if (event.message) {
                            // Extract Data
                            const senderId = event.sender?.id;
                            const recipientId = event.recipient?.id;
                            const timestamp = event.timestamp;

                            // Text Priority: text > quick_reply > postback
                            const text = event.message?.text
                                || event.message?.quick_reply?.payload
                                || event.postback?.payload;

                            if (senderId && recipientId && text) {
                                console.log(`[DM_EVENT] sender=${senderId} recipient=${recipientId} text="${text}"`);

                                // Delegate to Service
                                await processIncomingMessage({
                                    platform: "instagram",
                                    channel: "dm",
                                    senderId,
                                    recipientId,
                                    text,
                                    timestamp,
                                    rawEvent: event
                                });
                            } else {
                                console.log('[DM_EVENT] Ignored (non-text)');
                            }
                        }
                    }
                }
                // 2) Handle Changes (Comments) - Keep existing logic
                if (entry.changes) {
                    for (const change of entry.changes) {
                        if (change.field === 'comments' || change.field === 'feed') {
                            await handleCommentEvent(supabaseAdmin, entry.id, change.value)
                        }
                    }
                }
            }
        }

        return new NextResponse('EVENT_RECEIVED', { status: 200 })
    } catch (err) {
        console.error('Webhook Error:', err)
        return new NextResponse('Server Error', { status: 500 })
    }
}

// ... (Existing helper functions like replyToComment, handleCommentEvent remain below) ...
