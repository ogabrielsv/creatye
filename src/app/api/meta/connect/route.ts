
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const APP_ID = process.env.META_APP_ID
    const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/callback`
    const SCOPES = [
        'instagram_basic',
        'instagram_manage_messages',
        'instagram_manage_comments',
        'instagram_content_publish',
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_metadata' // For webhooks
    ].join(',')

    // Random state string for security (CSRF protection) would be better, but keeping simple for now
    const state = user.id

    const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&state=${state}&scope=${SCOPES}&response_type=code`

    return NextResponse.redirect(url)
}
