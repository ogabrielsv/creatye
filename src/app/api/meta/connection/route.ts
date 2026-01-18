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

    return NextResponse.json({
        connected: true,
        // Map fields explicitly if needed, or return raw data
        ig_username: data.ig_username || data.username,
        ig_name: data.ig_name,
        ig_profile_picture_url: data.ig_profile_picture_url,
        page_id: data.page_id, // Might be null for Creator/Business accounts direct login
        ig_business_account_id: data.ig_business_account_id,
        connected_at: data.connected_at
    });
}
