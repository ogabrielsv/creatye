import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TagNode = memo(({ data, selected }: NodeProps) => {
    const action = data.action || 'add'; // 'add' | 'remove'
    const tags = data.tags || [];

    return (
        <div className={cn(
            "w-[240px] bg-white rounded-xl shadow-sm border-2 transition-all",
            selected ? "border-blue-500 shadow-blue-500/20" : "border-zinc-200 hover:border-blue-300"
        )}>
            {/* Header */}
            <div className="p-3 border-b border-zinc-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <Tag size={16} />
                </div>
                <div>
                    <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">Tags</h3>
                    <p className="text-[10px] text-zinc-500">
                        {action === 'add' ? 'Adicionar Etiquetas' : 'Remover Etiquetas'}
                    </p>
                </div>
            </div>

            {/* Content Preview */}
            <div className="p-4 flex flex-col items-center justify-center gap-2 min-h-[60px]">
                {tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 justify-center">
                        {tags.slice(0, 3).map((t: string, i: number) => (
                            <span key={i} className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-medium border",
                                action === 'add'
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                                    : "bg-red-50 text-red-700 border-red-100"
                            )}>
                                {t}
                            </span>
                        ))}
                        {tags.length > 3 && (
                            <span className="text-[10px] text-zinc-400">+{tags.length - 3}</span>
                        )}
                    </div>
                ) : (
                    <span className="text-[10px] text-zinc-400 italic">Nenhuma tag selecionada</span>
                )}
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

TagNode.displayName = 'TagNode';
