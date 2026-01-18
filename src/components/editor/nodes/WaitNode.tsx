import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

export const WaitNode = memo(({ data, selected }: NodeProps) => {
    // Data format: data.duration = { hours: 0, minutes: 10, seconds: 0 } or flattened
    const hours = data.hours || 0;
    const minutes = data.minutes || 0;
    const seconds = data.seconds || 0;

    return (
        <div className={cn(
            "w-[240px] bg-white rounded-xl shadow-sm border-2 transition-all",
            selected ? "border-blue-500 shadow-blue-500/20" : "border-zinc-200 hover:border-blue-300"
        )}>
            {/* Header */}
            <div className="p-3 border-b border-zinc-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                    <Clock size={16} />
                </div>
                <div>
                    <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">Aguardar</h3>
                    <p className="text-[10px] text-zinc-500">Delay na execução</p>
                </div>
            </div>

            {/* Content Preview */}
            <div className="p-4 flex flex-col items-center justify-center">
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2 flex items-center gap-2">
                    <span className="text-lg font-bold text-zinc-700 font-mono">
                        {String(hours).padStart(2, '0')}:
                        {String(minutes).padStart(2, '0')}:
                        {String(seconds).padStart(2, '0')}
                    </span>
                </div>
                <span className="text-[10px] text-zinc-400 mt-2">Horas : Minutos : Segundos</span>
            </div>

            {/* Output Handle */}
            <div className="relative h-9 border-t border-zinc-100 flex items-center justify-end px-3 bg-zinc-50/50 rounded-b-xl">
                <span className="text-[10px] font-medium text-zinc-400 mr-2">Próximo passo</span>
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white shadow-sm hover:!bg-blue-600 transition-colors"
                />
            </div>

            <Handle
                type="target"
                position={Position.Left}
                className="!w-3 !h-3 !bg-zinc-400 !border-2 !border-white shadow-sm"
            />
        </div>
    );
});

WaitNode.displayName = 'WaitNode';
