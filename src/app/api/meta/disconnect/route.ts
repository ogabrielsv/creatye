import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Disconnect by deleting the record. 
        // This relies on RLS ensuring user can only delete their own.
        const { error } = await supabase
            .from('ig_connections')
            .delete()
            .eq('user_id', user.id);

        if (error) {
            throw error;
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error('Disconnect error:', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
