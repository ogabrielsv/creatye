import { Handle, Position } from 'reactflow';
import { Play } from 'lucide-react';

export function StartNode({ data, selected }: any) {
    const channels = data.channels || [];
    const triggers = data.triggers || [];

    // Simplistic display logic
    const label = channels.length > 0
        ? (channels.length > 1 ? `Multi-Canal (${channels.length})` : channels[0])
        : (data.label || 'Início');

    return (
        <div className={`px-4 py-2 rounded-full border-2 bg-white shadow-sm flex items-center gap-2 min-w-[120px] justify-center transition-colors ${selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-zinc-200'}`}>
            <div className="bg-green-100 p-1.5 rounded-full text-green-600">
                <Play size={14} fill="currentColor" />
            </div>
            <div className="flex flex-col">
                <span className="font-semibold text-sm text-zinc-900 capitalize">{label.replace('_', ' ')}</span>
                {triggers.length > 0 && <span className="text-[10px] text-zinc-400">Gatilho automático</span>}
            </div>

            <Handle
                type="source"
                position={Position.Right}
                className="!bg-blue-500 !w-3 !h-3 !-right-1.5"
            />
        </div>
    );
}
