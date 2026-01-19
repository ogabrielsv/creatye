
import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Send } from 'lucide-react';

const ActionNode = ({ data }: NodeProps) => {
    return (
        <div className="px-4 py-3 shadow-md rounded-lg bg-white border border-orange-200 min-w-[200px]">
            <Handle type="target" position={Position.Left} className="!bg-zinc-400 !w-3 !h-3" />
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 text-orange-600 rounded">
                    <Send size={14} />
                </div>
                <div className="text-sm font-bold text-zinc-900">Ação</div>
            </div>
            <div className="text-xs text-zinc-500 mt-2 truncate max-w-[180px]">
                {data.message ? `Enviar: "${data.message}"` : 'Configurar mensagem...'}
            </div>
            <Handle type="source" position={Position.Right} className="!bg-zinc-400 !w-3 !h-3" />
        </div>
    );
};

export default memo(ActionNode);
