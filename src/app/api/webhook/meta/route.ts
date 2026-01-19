import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendInstagramDM } from '@/lib/instagram/messenger'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED')
            return new NextResponse(challenge, { status: 200 })
        } else {
            return new NextResponse('Forbidden', { status: 403 })
        }
    }

    return new NextResponse('Bad Request', { status: 400 })
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        console.log('Webhook Payload:', JSON.stringify(body, null, 2))

        if (body.object === 'instagram') {
            const supabase = createAdminClient()
            for (const entry of body.entry) {
                const messagingEvents = entry.messaging || []
                for (const event of messagingEvents) {
                    if (event.message && !event.message.is_echo) {
                        await handleMessageEvent(supabase, event)
                    }
                }
            }
        }

        return new NextResponse('EVENT_RECEIVED', { status: 200 })
    } catch (err) {
        console.error('Webhook Error:', err)
        return new NextResponse('Server Error', { status: 500 })
    }
}

async function handleMessageEvent(supabase: any, event: any) {
    const senderId = event.sender?.id
    const recipientId = event.recipient?.id
    const messageText = event.message?.text

    if (!senderId || !recipientId || !messageText) return

    console.log('[DM] sender:', senderId, 'recipient:', recipientId, 'text:', messageText)

    // 1) encontrar connection pelo recipientId (instagram_scoped_id)
    let { data: connection } = await supabase
        .from('ig_connections')
        .select('*')
        .eq('instagram_scoped_id', recipientId)
        .maybeSingle()

    // 2) fallback antigo
    if (!connection) {
        const res2 = await supabase
            .from('ig_connections')
            .select('*')
            .eq('ig_user_id', recipientId)
            .maybeSingle()
        connection = res2.data ?? null
        if (connection) console.log('[DM] Found connection by ig_user_id fallback')
    }

    // 3) auto-link se ainda não achar
    if (!connection) {
        console.log('[DM] No connection for recipient:', recipientId, '=> trying auto-link latest connection...')
        const latest = await supabase
            .from('ig_connections')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (latest.data) {
            // vincula recipientId ao registro mais recente
            await supabase
                .from('ig_connections')
                .update({ instagram_scoped_id: recipientId })
                .eq('id', latest.data.id)

            connection = { ...latest.data, instagram_scoped_id: recipientId }
            console.log('[DM] Auto-linked recipientId to ig_connections.id:', latest.data.id)
        } else {
            console.log('[DM] Still no connection found; ig_connections empty.')
            return
        }
    }

    const userId = connection.user_id
    const accessToken = connection.access_token
    if (!userId || !accessToken) {
        console.log('[DM] connection missing user_id/access_token')
        return
    }

    // 4) carregar automações publicadas DM
    const { data: automations, error: autoError } = await supabase
        .from('automations')
        .select('*, automation_triggers(*), automation_actions(*)')
        .eq('user_id', userId)
        .eq('status', 'published')
        .eq('type', 'dm')

    if (autoError) {
        console.log('[DM] automations query error:', autoError)
        return
    }

    if (!automations || automations.length === 0) {
        console.log('[DM] no published dm automations for user:', userId)
        return
    }

    const normalizedMsg = messageText.trim().toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ')

    // 5) procurar trigger keyword match
    for (const auto of automations) {
        const triggers = auto.automation_triggers || []
        const matched = triggers.find((t: any) => {
            if (t.trigger_type !== 'keyword') return false
            const kw = (t.trigger_filter?.keyword || '').toString().trim().toLowerCase()
            if (!kw) return false
            const mode = (t.trigger_filter?.match_mode || 'contains').toString()
            if (mode === 'exact') return normalizedMsg === kw
            return normalizedMsg.includes(kw)
        })

        if (!matched) continue

        console.log('[DM] Matched automation:', auto.id, auto.name)

        // 6) criar execution running
        const { data: exec, error: execErr } = await supabase
            .from('automation_executions')
            .insert({
                automation_id: auto.id,
                user_id: userId,
                status: 'running',
                payload: { sender_id: senderId, recipient_id: recipientId, message: messageText }
            })
            .select()
            .single()

        if (execErr || !exec) {
            console.log('[DM] failed to create execution:', execErr)
            continue
        }

        const action = (auto.automation_actions || []).find((a: any) => a.kind === 'send_dm')
        if (!action?.message_text) {
            await supabase.from('automation_executions')
                .update({ status: 'failed', error: 'No send_dm action found' })
                .eq('id', exec.id)
            continue
        }

        try {
            await sendInstagramDM(accessToken, senderId, action.message_text)

            await supabase.from('automation_executions')
                .update({ status: 'success' })
                .eq('id', exec.id)

            console.log('[DM] Sent DM successfully')
        } catch (e: any) {
            await supabase.from('automation_executions')
                .update({ status: 'failed', error: (e?.message || JSON.stringify(e)) })
                .eq('id', exec.id)
            console.log('[DM] sendInstagramDM failed:', e)
        }

        // parar no primeiro match
        break
    }
}
