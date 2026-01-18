import { Handle, Position } from 'reactflow';
import { MessageSquare } from 'lucide-react';

export function MessageNode({ data, selected }: any) {
    return (
        <div className={`w-[280px] bg-white rounded-xl border shadow-sm transition-all ${selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-zinc-200'}`}>
            {/* Header */}
            <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-100 rounded-t-xl flex items-center gap-2">
                <MessageSquare size={14} className="text-zinc-500" />
                <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Mensagem</span>
            </div>

            {/* Body */}
            <div className="p-4">
                <div className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
                    {data.content || "Digite sua mensagem..."}
                </div>
            </div>

            <Handle type="target" position={Position.Left} className="!bg-zinc-400 !w-3 !h-3 !-left-1.5" />
            <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-3 !h-3 !-right-1.5" />
        </div>
    );
}
