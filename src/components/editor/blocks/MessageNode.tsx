import { Handle, Position, NodeProps } from 'reactflow';
import { MessageNodeData } from '@/lib/schemas/nodes';

export default function MessageNode({ data }: NodeProps<MessageNodeData>) {
    return (
        <div className="min-w-[250px] bg-white dark:bg-zinc-900 border-l-4 border-blue-500 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500" />

            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-blue-500">Mensagem</span>
            </div>

            <div className="p-4">
                <div className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                    {data.message || "Digite sua mensagem..."}
                </div>
            </div>

            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500" />
        </div>
    );
}
