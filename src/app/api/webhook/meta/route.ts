
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

    // 1. Find the connected user
    // Priority 1: Check by instagram_scoped_id
    let { data: connection, error: connError } = await supabase
        .from('ig_connections')
        .select('*')
        .eq('instagram_scoped_id', recipientId)
        .maybeSingle()

    // Priority 2: Check by ig_user_id (legacy/compat)
    if (!connection) {
        const { data: legacyConn } = await supabase
            .from('ig_connections')
            .select('*')
            .eq('ig_user_id', recipientId)
            .maybeSingle()

        if (legacyConn) {
            connection = legacyConn
            // Self-heal: Update the scoped ID for future lookups
            // We only update if it's missing to avoid overwriting invalidly 
            // (though if it matched ig_user_id, it's likely safe)
            await supabase
                .from('ig_connections')
                .update({ instagram_scoped_id: recipientId })
                .eq('id', legacyConn.id)
        }
    }

    // Priority 3: Auto-link heuristic (First webhook after recent connection)
    if (!connection) {
        // Look for connections created in the last 10 minutes that don't have a scoped_id yet
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

        const { data: recentConns } = await supabase
            .from('ig_connections')
            .select('*')
            .is('instagram_scoped_id', null)
            .gt('connected_at', tenMinutesAgo)
            .limit(2) // We only want if there's exactly one candidate

        if (recentConns && recentConns.length === 1) {
            connection = recentConns[0]
            console.log(`Auto-linking recipient ${recipientId} to user ${connection.user_id}`)

            // Save the link
            await supabase
                .from('ig_connections')
                .update({ instagram_scoped_id: recipientId })
                .eq('id', connection.id)
        }
    }

    if (!connection) {
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
            // New Schema: trigger_type & trigger_filter
            const type = (t.trigger_type || t.kind || '').toLowerCase()
            if (type !== 'keyword') return false

            const filter = t.trigger_filter || {}
            // keyword might be in filter.keyword (new) or t.keyword_text (old)
            const keyword = String(filter.keyword || t.keyword_text || t.keyword || '').trim().toLowerCase()
            if (!keyword) return false

            const matchMode = String(filter.match_mode || t.match_mode || 'contains').toLowerCase()

            if (matchMode === 'exact' || matchMode === 'equals') {
                return normalizedMsg === keyword
            }
            return normalizedMsg.includes(keyword)
        })

        if (matchedTrigger) {
            console.log(`Matched Automation: ${auto.name} (${auto.id})`)

            // 3. Rate Limit Check
            // Find recent executions for this automation & sender
            const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString()

            // Using filtering on the JSON column 'payload'
            // NOTE: .filter() is specific to some Supabase clients, if standard postgrest-js:
            // use .or() or directly inside .select() isn't easy for JSON.
            // Better to fetch and filter in memory if volume is low, OR use .contains().
            // .contains('payload', { sender_id: senderId }) is strictly better if sender_id key exists.

            const { count } = await supabase
                .from('automation_executions')
                .select('*', { count: 'exact', head: true })
                .eq('automation_id', auto.id)
                .eq('status', 'success')
                .contains('payload', { sender_id: senderId })
                .gt('created_at', thirtySecondsAgo)

            if (count && count > 0) {
                console.log('Rate limit exceeded for', senderId)
                continue
            }

            // 4. Create Execution Log
            const { data: execData, error: execErr } = await supabase
                .from('automation_executions')
                .insert({
                    automation_id: auto.id,
                    user_id: userId,
                    status: 'running',
                    payload: { sender_id: senderId, message: messageText, recipient_id: recipientId }
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
