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
        console.log('WEBHOOK_RECEIVED:', JSON.stringify(body, null, 2))

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

    // 1) Find connection (Robust Strategy with Logs)
    let connection = null

    // Try by scoped ID first
    let { data: connScoped } = await supabase
        .from('ig_connections')
        .select('*')
        .eq('instagram_scoped_id', recipientId)
        .maybeSingle()

    if (connScoped) {
        connection = connScoped
        console.log('CONNECTION_FOUND_BY_SCOPED_ID:', connection.id)
    } else {
        // Try by legacy ig_user_id
        let { data: connLegacy } = await supabase
            .from('ig_connections')
            .select('*')
            .eq('ig_user_id', recipientId)
            .maybeSingle()

        if (connLegacy) {
            connection = connLegacy
            console.log('CONNECTION_FOUND_BY_IG_USER_ID:', connection.id)
            // Self-heal
            await supabase.from('ig_connections').update({ instagram_scoped_id: recipientId }).eq('id', connection.id)
        } else {
            // Auto-link heuristic
            console.log('[DM] No connection found, trying auto-link...')
            const { data: latest } = await supabase
                .from('ig_connections')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (latest) {
                await supabase.from('ig_connections').update({ instagram_scoped_id: recipientId }).eq('id', latest.id)
                connection = { ...latest, instagram_scoped_id: recipientId }
                console.log('CONNECTION_AUTO_LINKED:', connection.id)
            }
        }
    }

    if (!connection) {
        console.log('CONNECTION_NOT_FOUND for recipient:', recipientId)
        return
    }

    const userId = connection.user_id
    const accessToken = connection.access_token

    // 2) Fetch Automations (Manual Query)
    const { data: automations, error: autoError } = await supabase
        .from('automations')
        .select('id, name, status, type, user_id')
        .eq('user_id', userId)
        .eq('status', 'published')
        .eq('type', 'dm')

    if (autoError) {
        console.log('AUTOMATIONS_QUERY_ERROR:', autoError)
        return
    }

    console.log(`AUTOMATIONS_FOUND: ${automations?.length || 0} for user ${userId}`)

    if (!automations || automations.length === 0) return

    const normalizedMsg = messageText.trim().toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ')

    // 3) Iterate Automations
    for (const auto of automations) {
        console.log(`Testing automation: ${auto.name} (${auto.id})`)

        // Fetch Triggers
        const { data: triggers } = await supabase
            .from('automation_triggers')
            .select('*')
            .eq('automation_id', auto.id)

        // Fetch Actions
        const { data: actions } = await supabase
            .from('automation_actions')
            .select('*')
            .eq('automation_id', auto.id)

        console.log(`TRIGGERS_FOUND: ${triggers?.length || 0}, ACTIONS_FOUND: ${actions?.length || 0}`)

        // Check Matches
        if (!triggers || triggers.length === 0) continue

        const matchedTrigger = triggers.find((t: any) => {
            const type = (t.trigger_type || '').toLowerCase()
            if (type !== 'keyword') return false

            const filter = t.trigger_filter || {}
            const keyword = String(filter.keyword || '').trim().toLowerCase()
            if (!keyword) return false

            const matchMode = String(filter.match_mode || 'contains').toLowerCase()
            const isExact = matchMode === 'exact' || matchMode === 'equals'

            console.log(`Checking trigger: keyword="${keyword}", mode="${matchMode}" against msg="${normalizedMsg}"`)

            if (isExact) return normalizedMsg === keyword
            return normalizedMsg.includes(keyword)
        })

        if (!matchedTrigger) {
            console.log('No trigger matched.')
            continue
        }

        console.log(`MATCHED_AUTOMATION: ${auto.id} (${auto.name})`)

        // 4) Execute
        const sendAction = actions?.find((a: any) => a.kind === 'send_dm')

        let execId: string | null = null

        const { data: exec, error: execErr } = await supabase
            .from('automation_executions')
            .insert({
                automation_id: auto.id,
                user_id: userId,
                status: 'running',
                payload: { sender_id: senderId, recipient_id: recipientId, message: messageText },
                updated_at: new Date().toISOString()
            })
            .select('id')
            .maybeSingle()

        if (execErr) {
            console.error('[EXEC_LOG] insert failed:', execErr)
            // NÃO bloqueia a automação: continua sem log
        } else if (exec?.id) {
            execId = exec.id
        }

        if (!sendAction || !sendAction.message_text) {
            console.log('No send_dm action found.')
            if (execId) {
                await supabase.from('automation_executions').update({ status: 'failed', error: 'No send_dm action' }).eq('id', execId)
            }
            continue
        }

        console.log('SENDING_DM...')
        try {
            await sendInstagramDM(accessToken, senderId, sendAction.message_text)
            if (execId) {
                await supabase.from('automation_executions').update({ status: 'success' }).eq('id', execId)
            }
            console.log('DM_SENT_OK')
        } catch (err: any) {
            console.error('DM_SENT_ERROR:', err)
            if (execId) {
                await supabase.from('automation_executions')
                    .update({ status: 'failed', error: err.message || JSON.stringify(err) })
                    .eq('id', execId)
            }
        }

        // Stop after first match
        break
    }
}
