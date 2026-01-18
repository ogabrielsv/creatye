
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Use a raw body reader helper if Next.js parses it automatically, 
// for verifying signature we need the raw buffer.
// However, in App Router, we can get text() from request.

export async function GET(request: Request) {
    // Verification Request from Meta
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
        const rawBody = await request.text()
        // Verify Signature (Recommended for production security)
        // const signature = request.headers.get('x-hub-signature-256')
        // ... verification logic ...

        const body = JSON.parse(rawBody)

        console.log('Webhook Received:', JSON.stringify(body, null, 2))

        if (body.object === 'instagram') {
            // Enqueue job or process directly
            // For "Deploy Ready", we just acknowledge receipt.

            // entry.forEach( entry => { ... })
        }

        return new NextResponse('EVENT_RECEIVED', { status: 200 })
    } catch (err) {
        console.error('Webhook Error:', err)
        return new NextResponse('Server Error', { status: 500 })
    }
}
