import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get Connection
    const { data: connection } = await supabase
        .from('ig_connections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!connection) {
        return NextResponse.json({ error: 'No Instagram connection found' }, { status: 404 });
    }

    // 2. Fetch Media from Graph API
    const accessToken = connection.access_token;
    const igUserId = connection.instagram_business_account_id || connection.ig_user_id;

    if (!igUserId) {
        return NextResponse.json({ error: 'Invalid connection ID' }, { status: 400 });
    }

    try {
        const fields = 'id,media_type,caption,permalink,media_url,thumbnail_url,timestamp';
        const url = `https://graph.facebook.com/v19.0/${igUserId}/media?fields=${fields}&limit=25&access_token=${accessToken}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('IG Graph Error:', data.error);
            // Fallback to cache? Or throw.
            throw new Error(data.error.message);
        }

        const mediaList = data.data || [];

        // 3. Upsert Cache in ig_media
        const upsertData = mediaList.map((m: any) => ({
            user_id: user.id,
            ig_connection_id: connection.id,
            media_id: m.id,
            media_type: m.media_type,
            caption: m.caption,
            permalink: m.permalink,
            media_url: m.media_url,
            thumbnail_url: m.thumbnail_url,
            timestamp: m.timestamp,
            raw: m,
            updated_at: new Date().toISOString()
        }));

        if (upsertData.length > 0) {
            const { error } = await supabase
                .from('ig_media')
                .upsert(upsertData, { onConflict: 'user_id,media_id' });

            if (error) console.error('Error caching media:', error);
        }

        return NextResponse.json({ data: mediaList });

    } catch (e: any) {
        console.error('Failed to fetch/cache media:', e);
        // Attempt to return cached media if API fails?
        const { data: cached } = await supabase
            .from('ig_media')
            .select('*')
            .eq('user_id', user.id)
            .order('timestamp', { ascending: false })
            .limit(25);

        return NextResponse.json({ data: cached || [], warning: 'Using cached data due to API error' });
    }
}
