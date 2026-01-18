import { Handle, Position, NodeProps } from 'reactflow';
import { ConditionNodeData } from '@/lib/schemas/nodes';

export default function ConditionNode({ data }: NodeProps<ConditionNodeData>) {
    return (
        <div className="min-w-[250px] bg-white dark:bg-zinc-900 border-l-4 border-yellow-500 rounded-lg shadow-md">
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-yellow-500" />

            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-yellow-50 dark:bg-yellow-900/10">
                <span className="text-xs font-bold uppercase text-yellow-600">Condição: Checar Tag</span>
            </div>

            <div className="p-4">
                <div className="text-sm text-zinc-600 dark:text-zinc-300">
                    Possui a tag: <strong>{data.tag || "..."}</strong>?
                </div>
            </div>

            <div className="flex border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex-1 p-2 border-r border-zinc-200 dark:border-zinc-800 relative">
                    <span className="text-xs font-bold text-green-600 block text-right pr-2">SIM</span>
                    <Handle type="source" position={Position.Right} id="true" className="w-3 h-3 bg-green-500 !top-[50%] !-right-1.5" />
                </div>
                <div className="flex-1 p-2 relative">
                    <span className="text-xs font-bold text-red-600 block text-right pr-2">NÃO</span>
                    <Handle type="source" position={Position.Right} id="false" className="w-3 h-3 bg-red-500 !top-[50%] !-right-1.5" />
                </div>
            </div>
        </div>
    );
}
