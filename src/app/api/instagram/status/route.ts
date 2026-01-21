import { createServerClient } from '@/lib/supabase/server-admin';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server'; // for auth context

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // Check Auth
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
        return NextResponse.json({ connected: false });
    }

    const supabaseAdmin = createServerClient();

    // Find active connection
    const { data } = await supabaseAdmin
        .from('instagram_accounts')
        .select('ig_username, ig_user_id')
        .eq('user_id', user.id)
        .is('disconnected_at', null)
        .maybeSingle();

    if (data) {
        return NextResponse.json({
            connected: true,
            ig_username: data.ig_username,
            ig_user_id: data.ig_user_id
        });
    }

    return NextResponse.json({ connected: false });
}
