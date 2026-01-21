import { createServerClient } from '@/lib/supabase/server-admin';
import { NextRequest, NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minute max for Vercel Hobby

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const env = getServerEnv();

    if (secret !== env.CRON_SECRET) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const supabase = createServerClient();

    // 1. Fetch enabled jobs
    // In a real robust system, we check 'next_run_at'. Here we run all enabled for simplicity or check a basic 'schedule'
    // Let's just run them if they are enabled.
    const { data: jobs } = await supabase
        .from('automation_jobs')
        .select(`
            *,
            instagram_accounts (
                access_token,
                status
            )
        `)
        .eq('enabled', true);

    if (!jobs || jobs.length === 0) {
        return NextResponse.json({ ran: 0 });
    }

    const results = [];

    for (const job of jobs) {
        const account = job.instagram_accounts;
        if (!account || account.status !== 'connected' || !account.access_token) {
            // Log error
            await log(supabase, job.user_id, job.id, job.instagram_account_id, 'error', 'Job pulado: conta desconectada ou token inválido');
            continue;
        }

        try {
            await log(supabase, job.user_id, job.id, job.instagram_account_id, 'info', `Iniciando job: ${job.name}`);

            if (job.type === 'SYNC_MEDIA') {
                // Fetch media
                const mediaRes = await fetch(
                    `https://graph.instagram.com/me/media?fields=id,caption,media_type,timestamp&limit=5&access_token=${account.access_token}`
                );
                const mediaData = await mediaRes.json();

                if (mediaData.error) throw new Error(mediaData.error.message);

                await log(supabase, job.user_id, job.id, job.instagram_account_id, 'info', `Sincronização OK. ${mediaData.data?.length || 0} mídias encontradas.`);
            }

            // Update Job Status
            await supabase.from('automation_jobs').update({
                last_run_at: new Date().toISOString(),
                last_status: 'ok'
            }).eq('id', job.id);

            results.push({ id: job.id, status: 'ok' });

        } catch (e: any) {
            console.error(`Job ${job.id} failed:`, e);
            await log(supabase, job.user_id, job.id, job.instagram_account_id, 'error', `Falha no job: ${e.message}`, { error: e });

            await supabase.from('automation_jobs').update({
                last_run_at: new Date().toISOString(),
                last_status: 'error'
            }).eq('id', job.id);

            results.push({ id: job.id, status: 'error', reason: e.message });
        }
    }

    return NextResponse.json({ ran: jobs.length, results });
}

async function log(supabase: any, userId: string, jobId: string, accountId: string, level: string, msg: string, meta?: any) {
    await supabase.from('automation_logs').insert({
        user_id: userId,
        job_id: jobId,
        instagram_account_id: accountId,
        level,
        message: msg,
        meta: meta || {}
    });
}
