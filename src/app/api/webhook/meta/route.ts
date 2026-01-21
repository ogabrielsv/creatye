import { createServerClient } from '@/lib/supabase/server-admin';
import { NextRequest, NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const env = getServerEnv();

    if (mode === 'subscribe' && token === env.META_WEBHOOK_VERIFY_TOKEN) {
        return new NextResponse(challenge);
    }

    return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const supabase = createServerClient();

    // Log raw entry quickly
    console.log('[WEBHOOK] Received:', JSON.stringify(body));

    // Process entries (basic logging example)
    if (body.object === 'instagram' && body.entry) {
        for (const entry of body.entry) {
            // Find account for this entry (entry.id is likely ig_user_id)
            const { data: account } = await supabase
                .from('instagram_accounts')
                .select('user_id')
                .eq('ig_user_id', entry.id)
                .single();

            const userId = account?.user_id || null;

            // Log execution
            await supabase.from('automation_executions').insert({
                user_id: userId, // might be null if not found, but we made it logs-safe
                ig_user_id: entry.id, // now nullable if needed, but here we have it
                raw_event: entry,
                status: userId ? 'received' : 'no_match',
                trigger_type: 'webhook_event'
            });
        }
    }

    return NextResponse.json({ received: true });
}
