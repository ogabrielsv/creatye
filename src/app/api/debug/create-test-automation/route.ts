import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    try {
        const supabaseUser = await createClient()
        const { data: { user } } = await supabaseUser.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = createAdminClient()

        // 1. Create automation
        const { data: auto, error: autoErr } = await supabase
            .from('automations')
            .insert({
                user_id: user.id,
                name: 'Teste DM (oi) ' + new Date().toISOString(),
                status: 'published',
                type: 'dm'
            })
            .select()
            .single()

        if (autoErr || !auto) {
            return NextResponse.json({ error: 'Create automation failed', details: autoErr }, { status: 500 })
        }

        // 2. Create Trigger (oi)
        await supabase.from('automation_triggers').insert({
            automation_id: auto.id,
            user_id: user.id,
            trigger_type: 'keyword',
            trigger_filter: {
                keyword: 'oi',
                match_mode: 'contains',
                case_insensitive: true
            }
        })

        // 3. Create Action (aprovado)
        await supabase.from('automation_actions').insert({
            automation_id: auto.id,
            user_id: user.id,
            kind: 'send_dm',
            message_text: 'aprovado'
        })

        // 4. Create Draft (for UI)
        const nodes = [
            { id: '1', type: 'triggerNode', position: { x: 0, y: 0 }, data: { keyword: 'oi', matchType: 'contains' } },
            { id: '2', type: 'actionNode', position: { x: 200, y: 0 }, data: { message: 'aprovado' } }
        ]
        const edges = [
            { id: 'e1-2', source: '1', target: '2' }
        ]

        await supabase.from('automation_drafts').insert({
            automation_id: auto.id,
            user_id: user.id,
            nodes,
            edges
        })

        return NextResponse.json({ success: true, automation_id: auto.id })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
