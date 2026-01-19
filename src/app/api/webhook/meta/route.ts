
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
    const { data: automations, error: autoError } = await supabase
        .from('automations')
        .select(`*, automation_triggers (*), automation_actions (*)`)
        .eq('user_id', userId)
        .eq('status', 'published')
        .eq('type', 'dm')

    if (autoError || !automations) return

    const normalizedMsg = messageText
        .trim()
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')

    for (const auto of automations) {
        const triggers = auto.automation_triggers || []
        const matchedTrigger = triggers.find((t: any) => {
            const triggerType = String(t.trigger_type || t.kind || '').toLowerCase()
            if (triggerType !== 'keyword') return false

            const filter = t.trigger_filter || {}
            const keyword = String(filter.keyword || t.keyword || t.keyword_text || '').trim().toLowerCase()
            if (!keyword) return false

            const matchMode = String(filter.match_mode || t.match_mode || 'contains').toLowerCase()

            if (matchMode === 'exact' || matchMode === 'equals') {
                return normalizedMsg === keyword
            }
            return normalizedMsg.includes(keyword)
        })

        if (matchedTrigger) {
            console.log(`Matched Automation: ${auto.name} (${auto.id})`)

            // Create execution log
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
