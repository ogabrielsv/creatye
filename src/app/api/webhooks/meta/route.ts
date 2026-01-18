import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    // Verification Challenge for Meta Webhooks
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
    }

    return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
    // Handle Incoming Events (Messages, etc.)
    const body = await req.json();
    console.log('Webhook Received:', body);

    // Trigger Automations here?
    // 1. Extract Sender ID
    // 2. Find Contact in DB
    // 3. Check for active execution in 'waiting' state (input await) or Start New

    return NextResponse.json({ received: true });
}
