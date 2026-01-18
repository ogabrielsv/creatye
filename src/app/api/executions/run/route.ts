import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { automationId, contactId } = await req.json();

    if (!automationId || !contactId) {
        return NextResponse.json({ error: 'Missing automationId or contactId' }, { status: 400 });
    }

    // 1. Get Published Version
    const { data: version, error: versionError } = await supabase
        .from('automation_versions')
        .select('*')
        .eq('automation_id', automationId)
        .eq('is_published', true)
        .order('version', { ascending: false }) // Just in case multiple true
        .limit(1)
        .single();

    if (versionError || !version) {
        return NextResponse.json({ error: 'No published version found' }, { status: 404 });
    }

    // 2. Find Start Node
    const nodes = version.nodes as any[];
    const startNode = nodes.find(n => n.type === 'start');

    if (!startNode) {
        return NextResponse.json({ error: 'Invalid flow: No start node' }, { status: 500 });
    }

    // 3. Create Execution
    const { data: execution, error: execError } = await supabase
        .from('automation_executions')
        .insert({
            automation_id: automationId,
            version_id: version.id,
            contact_id: contactId,
            current_node_id: startNode.id,
            status: 'running',
            context: {}
        })
        .select()
        .single();

    if (execError) {
        return NextResponse.json({ error: 'Failed to create execution' }, { status: 500 });
    }

    // 4. Trigger first tick (or create specific job to start)
    // For immediate execution, we can return success and let a separate "tick" worker pick it up, 
    // or we can invoke the tick logic immediately.
    // We'll insert a "job" for the start node (or technically, the tick processor looks for running executions).
    // Better pattern: Create a job for "process_node" with the start node.

    const { error: jobError } = await supabase
        .from('automation_jobs')
        .insert({
            execution_id: execution.id,
            run_at: new Date().toISOString(), // Now
            status: 'queued',
            payload: { nodeId: startNode.id, action: 'start' }
        });

    return NextResponse.json({ success: true, executionId: execution.id });
}
