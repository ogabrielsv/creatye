import { Handle, Position } from 'reactflow';
import { Split } from 'lucide-react';

export function ConditionNode({ data, selected }: any) {
    return (
        <div className={`w-[240px] bg-white rounded-xl border shadow-sm transition-all ${selected ? 'border-purple-500 ring-2 ring-purple-100' : 'border-zinc-200'}`}>
            <div className="bg-purple-50 px-4 py-2 border-b border-purple-100 rounded-t-xl flex items-center gap-2">
                <Split size={14} className="text-purple-600" />
                <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Condição</span>
            </div>

            <div className="p-4">
                <p className="text-xs text-zinc-500 mb-1">Verificar se tem a tag:</p>
                <div className="bg-zinc-100 px-2 py-1 rounded text-sm font-medium text-zinc-700 truncate">
                    {data.tagName || "Selecionar tag..."}
                </div>
            </div>

            <div className="absolute -right-3 top-10 flex flex-col gap-6">
                <div className="relative group">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-600 bg-green-50 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">SIM</span>
                    <Handle
                        type="source"
                        position={Position.Right}
                        id="true"
                        className="!bg-green-500 !w-3 !h-3 !border-2 !border-white"
                    />
                </div>
                <div className="relative group">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-600 bg-red-50 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">NÃO</span>
                    <Handle
                        type="source"
                        position={Position.Right}
                        id="false"
                        className="!bg-red-500 !w-3 !h-3 !border-2 !border-white"
                    />
                </div>
            </div>

            <Handle type="target" position={Position.Left} className="!bg-zinc-400 !w-3 !h-3 !-left-1.5" />
        </div>
    );
}
