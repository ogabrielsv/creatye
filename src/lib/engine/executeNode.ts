import { createClient } from '@/lib/supabase/server';
import { sendInstagramMessage } from './providers/instagram';

export async function executeNode(executionId: string, nodeId: string, nodeType: string, nodeData: any, context: any) {
    const supabase = createClient();

    // 1. Log Start
    console.log(`Executing node ${nodeId} (${nodeType})`);

    // 2. Logic Switch
    switch (nodeType) {
        case 'message':
        case 'buttons':
            await sendInstagramMessage('system', 'contact_mock', nodeData.message || '');
            // Increment Sent Metric
            await incrementMetric(executionId, nodeId, 'sent');
            break;

        case 'add_tag':
            // await addTagToContact(...)
            break;

        case 'remove_tag':
            // await removeTagFromContact(...)
            break;

        // ...
    }

    return { success: true };
}

async function incrementMetric(executionId: string, nodeId: string, outputString: 'sent' | 'read' | 'clicked') {
    // Logic to increment node_metrics
    // Needs automation_id and version_id from execution...
}
