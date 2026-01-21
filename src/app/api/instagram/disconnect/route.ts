import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getSafeConfigColumns } from '@/lib/supabase/safe-columns'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    )

    // Build safe update payload
    const safeCols = await getSafeConfigColumns(supabaseAdmin);
    const updates: any = {};

    if (safeCols.has('disconnected_at')) updates.disconnected_at = new Date().toISOString();
    if (safeCols.has('page_access_token')) updates.page_access_token = null;
    if (safeCols.has('user_access_token')) updates.user_access_token = null;

    if (Object.keys(updates).length === 0) {
        // Fallback if no columns found (should not happen if migration ran)
        // Ensure we at least do something or return ok
        return NextResponse.json({ ok: true, note: 'No columns to update' });
    }

    const { error } = await supabaseAdmin
        .from('instagram_accounts')
        .update(updates)
        .eq('user_id', user.id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}
