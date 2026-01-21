import { createServerClient } from '@/lib/supabase/server-admin';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createServerClient();

    // Revoke by clearing tokens and setting disconnected_at
    const { error } = await supabaseAdmin
        .from('instagram_accounts')
        .update({
            disconnected_at: new Date().toISOString(),
            access_token: 'revoked',
            page_access_token: null
        })
        .eq('user_id', user.id)
        .is('disconnected_at', null);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
