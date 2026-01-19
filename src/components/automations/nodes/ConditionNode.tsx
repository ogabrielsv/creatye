
import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GitFork } from 'lucide-react';

const ConditionNode = ({ data }: NodeProps) => {
    return (
        <div className="px-4 py-3 shadow-md rounded-lg bg-white border border-purple-200 min-w-[200px]">
            <Handle type="target" position={Position.Left} className="!bg-zinc-400 !w-3 !h-3" />
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 text-purple-600 rounded">
                    <GitFork size={14} />
                </div>
                <div className="text-sm font-bold text-zinc-900">Condição</div>
            </div>
            <div className="text-xs text-zinc-500 mt-2">
                {data.condition ? `${data.condition}` : 'Configurar condição...'}
            </div>

            {/* Supports True/False paths */}
            <div className="flex justify-between mt-3 text-[10px] font-bold text-zinc-400 uppercase">
                <span className="text-green-600">Sim</span>
                <span className="text-red-500">Não</span>
            </div>

            <Handle
                type="source"
                position={Position.Right}
                id="true"
                className="!bg-green-500 !w-3 !h-3 !top-[70%]"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="false"
                className="!bg-red-500 !w-3 !h-3"
            />
        </div>
    );
};

export default memo(ConditionNode);
