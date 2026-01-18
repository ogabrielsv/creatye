import { Handle, Position, NodeProps } from 'reactflow';
import { WaitNodeData } from '@/lib/schemas/nodes';
import { Clock } from 'lucide-react';

export default function WaitNode({ data }: NodeProps<WaitNodeData>) {
    return (
        <div className="w-[120px] bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 rounded-lg shadow-sm flex flex-col items-center justify-center p-2">
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-zinc-400" />

            <Clock className="w-6 h-6 text-zinc-400 mb-1" />
            <span className="text-xs font-bold text-zinc-500 uppercase">Aguardar</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{data.delaySeconds || 0}s</span>

            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-zinc-400" />
        </div>
    );
}
