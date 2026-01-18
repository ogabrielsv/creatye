import { Handle, Position, NodeProps } from 'reactflow';
import { TagNodeData } from '@/lib/schemas/nodes';

export default function AddTagNode({ data }: NodeProps<TagNodeData>) {
    return (
        <div className="min-w-[200px] bg-white dark:bg-zinc-900 border-l-4 border-orange-500 rounded-lg shadow-md">
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-orange-500" />

            <div className="p-3 flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-orange-500">Adicionar Tag</span>
            </div>

            <div className="px-3 pb-3">
                <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 px-2 py-1 rounded text-sm text-center font-medium">
                    {data.tag || "Selecione..."}
                </div>
            </div>

            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-orange-500" />
        </div>
    );
}
