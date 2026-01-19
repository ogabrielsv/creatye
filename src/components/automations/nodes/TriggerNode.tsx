
import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { MessageCircle } from 'lucide-react'; // Example icon

const TriggerNode = ({ data }: NodeProps) => {
    return (
        <div className="px-4 py-3 shadow-md rounded-lg bg-white border border-blue-200 min-w-[200px]">
            <Handle type="target" position={Position.Left} className="!bg-zinc-400 !w-3 !h-3" />
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 text-blue-600 rounded">
                    <MessageCircle size={14} />
                </div>
                <div className="text-sm font-bold text-zinc-900">Gatilho</div>
            </div>
            <div className="text-xs text-zinc-500 mt-2">
                {data.keyword ? `Quando: "${data.keyword}"` : 'Configurar gatilho...'}
            </div>
            <Handle type="source" position={Position.Right} className="!bg-zinc-400 !w-3 !h-3" />
        </div>
    );
};

export default memo(TriggerNode);
