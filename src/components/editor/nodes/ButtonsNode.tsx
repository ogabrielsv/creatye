import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { cn } from '@/lib/utils';
import { MousePointerClick, ExternalLink } from 'lucide-react';

export const ButtonsNode = memo(({ data, selected }: NodeProps) => {
    return (
        <div className={cn(
            "w-[280px] bg-white rounded-xl shadow-sm border-2 transition-all group",
            selected ? "border-blue-500 shadow-blue-500/20" : "border-zinc-200 hover:border-blue-300"
        )}>
            {/* Header */}
            <div className="p-3 border-b border-zinc-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center text-pink-600">
                    <MousePointerClick size={16} />
                </div>
                <div>
                    <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">Botões</h3>
                    <p className="text-[10px] text-zinc-500">Mensagem com botões</p>
                </div>
            </div>

            {/* Message Content */}
            <div className="p-4 bg-zinc-50/50">
                <div className="text-xs text-zinc-700 whitespace-pre-wrap line-clamp-4 font-medium">
                    {data.content || "Digite sua mensagem..."}
                </div>
            </div>

            {/* Buttons List */}
            <div className="p-2 space-y-2">
                {(data.buttons || []).map((btn: any, i: number) => (
                    <div key={i} className="relative group/btn">
                        <div className="w-full p-2 bg-blue-50 border border-blue-100 text-blue-600 rounded-lg text-xs font-bold text-center uppercase tracking-wide">
                            {btn.label || 'Botão'}
                            {btn.type === 'web_url' && <ExternalLink size={10} className="ml-1 inline-block" />}
                        </div>
                        {/* Dynamic Handle for each button */}
                        <Handle
                            type="source"
                            position={Position.Right}
                            id={`btn-${i}`}
                            className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white shadow-sm !-right-1.5"
                        />
                    </div>
                ))}
                {(!data.buttons || data.buttons.length === 0) && (
                    <div className="text-[10px] text-zinc-400 text-center py-2 italic">
                        Nenhum botão configurado
                    </div>
                )}
            </div>

            <div className="relative h-9 border-t border-zinc-100 flex items-center justify-end px-3 bg-zinc-50/50 rounded-b-xl">
                <span className="text-[10px] font-medium text-zinc-400 mr-2">Próximo passo</span>
                <Handle
                    type="source"
                    position={Position.Right}
                    id="default"
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

ButtonsNode.displayName = 'ButtonsNode';
