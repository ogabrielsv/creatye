import { Handle, Position, NodeProps } from 'reactflow';
import { TagNodeData } from '@/lib/schemas/nodes';

export default function RemoveTagNode({ data }: NodeProps<TagNodeData>) {
    return (
        <div className="min-w-[200px] bg-white dark:bg-zinc-900 border-l-4 border-gray-500 rounded-lg shadow-md">
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-gray-500" />

            <div className="p-3 flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-gray-500">Remover Tag</span>
            </div>

            <div className="px-3 pb-3">
                <div className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded text-sm text-center font-medium line-through decoration-red-500">
                    {data.tag || "Selecione..."}
                </div>
            </div>

            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-gray-500" />
        </div>
    );
}
