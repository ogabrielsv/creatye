
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin' // You'll need to create this or use a workaround if standard client is cookie-based
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
                // messaging events are often in entry.messaging
                // or sometimes entry.changes for other types, but for DM it's messaging
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
    const senderId = event.sender.id
    const recipientId = event.recipient.id
    const messageText = event.message.text

    if (!messageText) return

    console.log(`Received DM: "${messageText}" from ${senderId} to ${recipientId}`)

    // 1. Find the connected user (the "owner" of this recipient_id)
    const { data: connection, error: connError } = await supabase
        .from('ig_connections')
        .select('*')
        .eq('ig_user_id', recipientId)
        .maybeSingle()

    if (connError || !connection) {
        console.error('No connection found for recipient:', recipientId)
        return
    }

    const userId = connection.user_id

    // 2. Find matching automations
    // We need published DM automations for this user
    const { data: automations, error: autoError } = await supabase
        .from('automations')
        .select(`
            *,
            automation_triggers (*),
            automation_actions (*)
        `)
        .eq('user_id', userId)
        .eq('status', 'published')
        .eq('type', 'dm')

    if (autoError || !automations) return

    const normalizedMsg = messageText.trim().toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ')

    for (const auto of automations) {
        // Check triggers
        const triggers = auto.automation_triggers || []
        const matchedTrigger = triggers.find((t: any) => {
            if (t.kind !== 'keyword') return false
            const keyword = (t.keyword_text || '').trim().toLowerCase()
            if (!keyword) return false

            if (t.match_mode === 'exact') {
                return normalizedMsg === keyword
            } else {
                return normalizedMsg.includes(keyword)
            }
        })

        if (matchedTrigger) {
            console.log(`Matched Automation: ${auto.name} (${auto.id})`)

            // 3. Rate Limit Check (debounce)
            // Check last execution for this sender/automation in last 30s
            const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString()

            const { count } = await supabase
                .from('automation_executions')
                .select('*', { count: 'exact', head: true })
                .eq('automation_id', auto.id)
                .eq('status', 'success') // or any status? let's limit successes usually
                .contains('payload', { sender_id: senderId }) // assuming payload stores this
                .gt('created_at', thirtySecondsAgo)

            if (count && count > 0) {
                console.log('Rate limit exceeded for', senderId)
                continue
            }

            // 4. Execute Action
            // Create 'running' execution log
            const { data: execData, error: execErr } = await supabase
                .from('automation_executions')
                .insert({
                    automation_id: auto.id,
                    user_id: userId,
                    status: 'running',
                    payload: { sender_id: senderId, message: messageText }
                })
                .select()
                .single()

            if (execErr) {
                console.error('Failed to create execution log', execErr)
                continue
            }

            const execId = execData.id
            const actions = auto.automation_actions || []
            const sendAction = actions.find((a: any) => a.kind === 'send_dm')

            if (sendAction && sendAction.message_text) {
                try {
                    await sendInstagramDM(connection.access_token, senderId, sendAction.message_text)

                    // Mark success
                    await supabase
                        .from('automation_executions')
                        .update({ status: 'success' })
                        .eq('id', execId)

                    console.log('Action executed successfully')
                } catch (actionErr: any) {
                    // Mark failed
                    console.error('Action failed', actionErr)
                    await supabase
                        .from('automation_executions')
                        .update({
                            status: 'failed',
                            error: actionErr.message || JSON.stringify(actionErr)
                        })
                        .eq('id', execId)

                    // Optional: If token invalid, allow backend to mark disconnected
                    // if (actionErr.message?.includes('session') || actionErr.code === 190) ...
                }
            } else {
                await supabase
                    .from('automation_executions')
                    .update({
                        status: 'failed',
                        error: 'No send_dm action found'
                    })
                    .eq('id', execId)
            }
        }
    }
}
