import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// This endpoint would normally be called by a cron job or a recursive fetch
export async function POST(req: NextRequest) {
    const supabase = createClient();

    // 1. Fetch queued jobs ready to run
    const { data: jobs, error } = await supabase
        .from('automation_jobs')
        .select(`
            *,
            execution:automation_executions (
                *,
                version:automation_versions (nodes, edges)
            )
        `)
        .eq('status', 'queued')
        .lte('run_at', new Date().toISOString())
        .limit(10); // Batch size

    if (error || !jobs) return NextResponse.json({ processed: 0 });

    const results = [];

    for (const job of jobs) {
        // Process Logic Stub
        // In a real system, we'd delegate this to a library function 'processJob(job)'

        // Mark as processing (optional, or just delete/update after)

        try {
            const execution = job.execution;
            if (!execution) {
                await supabase.from('automation_jobs').update({ status: 'failed', payload: { error: 'No execution' } }).eq('id', job.id);
                continue;
            }

            const nodes = execution.version.nodes as any[];
            const edges = execution.version.edges as any[];
            const currentNodeId = job.payload.nodeId;
            const currentNode = nodes.find(n => n.id === currentNodeId);

            if (!currentNode) {
                await supabase.from('automation_jobs').update({ status: 'failed', payload: { error: 'Node not found' } }).eq('id', job.id);
                continue;
            }

            // --- EXECUTE NODE LOGIC ---
            console.log(`Executing node ${currentNode.type} for contact ${execution.contact_id}`);

            // 1. Perform Action (Send Message, Add Tag, etc.)
            // switch(currentNode.type) ...

            // 2. Determine Next Node
            // Find edges from this node
            const outEdges = edges.filter(e => e.source === currentNodeId);
            let nextNodeId = null;

            if (outEdges.length > 0) {
                // If condition, evaluate logic to pick edge
                // For now, take first
                nextNodeId = outEdges[0].target;
            }

            // 3. Update Job / Create Next Job
            if (nextNodeId) {
                // Determine run_at (if wait node)
                let runAt = new Date();
                const nextNode = nodes.find(n => n.id === nextNodeId);

                if (nextNode?.type === 'wait') {
                    const delay = nextNode.data.delaySeconds || 0;
                    runAt.setSeconds(runAt.getSeconds() + delay);
                    // Advance past wait? No, the wait node IS the next step. 
                    // Actually, usually "Wait" means "Pause here".
                    // So we queue the job for the *next* node after wait?
                    // Pattern:
                    // Current: Wait Node. Action: Schedule next job after delay.
                    // Current: Message. Action: Send. Schedule next job immediately.

                    // If Current is Wait:
                    // We just executed "Wait". Meaning we are "starting" the wait.
                    // So we really want to schedule the *output* of the wait node.
                    // Finding edge out of wait.
                    const waitEdges = edges.filter(e => e.source === nextNodeId);
                    if (waitEdges.length > 0) {
                        const afterWaitNodeId = waitEdges[0].target;
                        await supabase.from('automation_jobs').insert({
                            execution_id: execution.id,
                            run_at: runAt.toISOString(),
                            status: 'queued',
                            payload: { nodeId: afterWaitNodeId }
                        });
                    }
                } else {
                    // Immediate
                    await supabase.from('automation_jobs').insert({
                        execution_id: execution.id,
                        run_at: runAt.toISOString(),
                        status: 'queued',
                        payload: { nodeId: nextNodeId }
                    });
                }
            } else {
                // End of flow
                await supabase.from('automation_executions').update({ status: 'finished' }).eq('id', execution.id);
            }

            // Mark current job done
            await supabase.from('automation_jobs').update({ status: 'done' }).eq('id', job.id);
            results.push({ jobId: job.id, status: 'done' });

        } catch (e) {
            console.error(e);
            await supabase.from('automation_jobs').update({ status: 'failed' }).eq('id', job.id);
        }
    }

    return NextResponse.json({ processed: results.length, jobs: results });
}
