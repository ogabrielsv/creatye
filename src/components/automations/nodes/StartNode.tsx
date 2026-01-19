
import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Play } from 'lucide-react';

const StartNode = () => {
    return (
        <div className="px-4 py-3 shadow-md rounded-lg bg-white border border-zinc-200 min-w-[150px]">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-100 text-green-600 rounded">
                    <Play size={14} fill="currentColor" />
                </div>
                <div className="text-sm font-bold text-zinc-900">Início</div>
            </div>
            <div className="text-xs text-zinc-500 mt-1">Ponto de partida</div>
            <Handle type="source" position={Position.Right} className="!bg-zinc-400 !w-3 !h-3" />
        </div>
    );
};

export default memo(StartNode);
