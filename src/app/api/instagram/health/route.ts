import { createServerClient } from '@/lib/supabase/server-admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = createServerClient();
        const { count, error } = await supabase.from('instagram_accounts').select('id', { count: 'exact', head: true });

        if (error) throw error;

        return NextResponse.json({
            ok: true,
            db_connected: true,
            account_count: count
        });
    } catch (e: any) {
        return NextResponse.json({
            ok: false,
            error: e.message
        }, { status: 500 });
    }
}
