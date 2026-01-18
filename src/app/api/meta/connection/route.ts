import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ connected: false });
    }

    const { data, error } = await supabase
        .from('ig_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

    if (!data) {
        return NextResponse.json({ connected: false });
    }

    // Check if logically connected (has token and not disconnected)
    const isConnected = !!data.access_token && !data.disconnected_at;

    if (!isConnected) {
        return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
        connected: true,
        ig_username: data.ig_username,
        ig_name: data.ig_name,
        ig_profile_picture_url: data.ig_profile_picture_url,
        connected_at: data.connected_at
    });
}
