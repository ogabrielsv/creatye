
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (!user) {
        console.log('[API] Unauthorized access to /api/automations/[id]', {
            authError,
            hasCookies: req.headers.get('cookie')?.length ? true : false,
            id: params.id,
        })
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
        .from('automations')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .maybeSingle()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
        return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }

    return NextResponse.json({ automation: data })
}
