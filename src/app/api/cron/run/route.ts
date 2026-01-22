import { createServerClient } from '@/lib/supabase/server-admin';
import { NextRequest, NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { runAutomations, logAutomation } from '@/lib/services/automations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute max for Vercel Hobby

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const env = getServerEnv();

    const authHeader = request.headers.get('authorization');
    const hasValidAuth = (authHeader === `Bearer ${env.CRON_SECRET}`) || (secret === env.CRON_SECRET);

    if (!hasValidAuth) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const supabase = createServerClient();
    const startTime = Date.now();
    let processedEvents = 0;
    let processedJobs = 0;
    let errorCount = 0;

    // Create Automation Run Record
    let runId: string | undefined;
    try {
        const { data: runData, error: runError } = await supabase
            .from('automation_runs')
            .insert({ status: 'running' })
            .select('run_id')
            .single();

        if (runError) {
            console.error('[CRON] Failed to create run record', runError);
        } else {
            runId = runData.run_id;
        }
    } catch (e) {
        console.error('[CRON] Error creating run', e);
    }

    console.info(`[CRON] Started RunID=${runId}`);
    // Log start
    await logAutomation(supabase, null, null, 'info', 'Cron Run Started', { runId }, runId);

    try {
        // --- PART 1: Process Webhook Events ---
        const { data: events, error: eventErr } = await supabase
            .from('webhook_events')
            .select('*')
            .is('processed_at', null)
            .limit(50); // Batch limit

        if (eventErr) throw eventErr;

        if (events && events.length > 0) {
            console.info(`[CRON] found ${events.length} pending events`);
            for (const event of events) {
                try {
                    await runAutomations(event, supabase);
                    // Mark as processed
                    await supabase.from('webhook_events').update({ processed_at: new Date().toISOString() }).eq('id', event.id);
                    processedEvents++;

                    await logAutomation(supabase, null, null, 'info', `Event processed: ${event.id}`, { event_id: event.id }, runId);
                } catch (e) {
                    console.error(`[CRON] Event ${event.id} failed`, e);
                    errorCount++;
                    // Optionally mark as processed-with-error to avoid stuck loop, or leave for retry
                    await supabase.from('webhook_events').update({
                        processed_at: new Date().toISOString()
                    }).eq('id', event.id);
                    await logAutomation(supabase, null, null, 'error', `Event failed: ${event.id}`, { event_id: event.id, error: e }, runId);
                }
            }
        }

        // --- PART 2: Run Polling Jobs (Existing Logic) ---
        const { data: jobs } = await supabase
            .from('automation_jobs')
            .select(`*, instagram_accounts (access_token, status)`)
            .eq('enabled', true);

        if (jobs && jobs.length > 0) {
            for (const job of jobs) {
                try {
                    const account = job.instagram_accounts;
                    if (account?.status === 'connected' && account.access_token) {
                        await logAutomation(supabase, job.user_id, job.instagram_account_id, 'info', `Running scheduled job: ${job.name}`, { job_id: job.id }, runId, job.id);

                        await supabase.from('automation_jobs').update({
                            last_run_at: new Date().toISOString(),
                            last_status: 'ok'
                        }).eq('id', job.id);
                        processedJobs++;
                    } else {
                        // Skip but verify if we should log skip
                    }
                } catch (e: any) {
                    console.error(`[CRON] Job ${job.id} failed`, e);
                    errorCount++;
                    await logAutomation(supabase, job.user_id, job.instagram_account_id, 'error', `Job failed: ${job.name}`, { job_id: job.id, error: e.message }, runId, job.id);
                }
            }
        }

        // Final Log
        await logAutomation(supabase, null, null, 'info', 'Cron Run Completed', {
            duration_ms: Date.now() - startTime,
            processedEvents,
            processedJobs,
            errorCount
        }, runId);

        // Update Run Record
        if (runId) {
            await supabase.from('automation_runs').update({
                status: errorCount > 0 ? 'completed_with_errors' : 'completed',
                finished_at: new Date().toISOString(),
                counts: { processedEvents, processedJobs, errorCount }
            }).eq('run_id', runId);
        }

        return NextResponse.json({
            ran: true,
            processedEvents,
            processedJobs,
            errors: errorCount
        });

    } catch (e: any) {
        console.error('[CRON] Critical Error', e);
        if (runId) {
            await supabase.from('automation_runs').update({
                status: 'failed',
                error: e.message,
                finished_at: new Date().toISOString()
            }).eq('run_id', runId);
        }
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
