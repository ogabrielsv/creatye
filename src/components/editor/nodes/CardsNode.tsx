import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GalleryHorizontal, ImageIcon, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
// import { NodeCard, NodeHeader } from './NodeComponents'; // Removed unused import

export const CardsNode = memo(({ data, selected }: NodeProps) => {
    const cards = data.cards || [];
    const firstCard = cards[0];

    return (
        <div className={cn(
            "w-[280px] bg-white rounded-xl shadow-sm border-2 transition-all group",
            selected ? "border-blue-500 shadow-blue-500/20" : "border-zinc-200 hover:border-blue-300"
        )}>
            {/* Header */}
            <div className="p-3 border-b border-zinc-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center text-pink-600">
                    <GalleryHorizontal size={16} />
                </div>
                <div>
                    <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">Cartões</h3>
                    <p className="text-[10px] text-zinc-500">Carrossel interativo</p>
                </div>
            </div>

            {/* Metrics Placeholder */}
            {/* <div className="flex border-b border-zinc-100">
                <div className="flex-1 p-2 text-center border-r border-zinc-100">
                    <span className="block text-[10px] text-zinc-400">Envios</span>
                    <span className="block text-sm font-bold text-blue-600">0</span>
                </div>
                <div className="flex-1 p-2 text-center">
                    <span className="block text-[10px] text-zinc-400">Leituras</span>
                    <span className="block text-sm font-bold text-blue-600">0%</span>
                </div>
            </div> */}

            {/* Content Preview */}
            <div className="p-3">
                {cards.length > 0 ? (
                    <div className="relative aspect-square bg-zinc-100 rounded-lg overflow-hidden border border-zinc-100 mb-3 group-hover:shadow-sm transition-shadow">
                        {firstCard?.image ? (
                            <img src={firstCard.image} alt="Card" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
                                <ImageIcon size={24} />
                                <span className="text-[10px] mt-1">Sem imagem</span>
                            </div>
                        )}
                        {cards.length > 1 && (
                            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                                +{cards.length - 1}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-4 text-center text-xs text-zinc-400 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                        Nenhum cartão configurado
                    </div>
                )}

                {firstCard && (
                    <div className="space-y-1">
                        <p className="font-bold text-sm text-zinc-800 line-clamp-1">{firstCard.title || 'Sem título'}</p>
                        <p className="text-xs text-zinc-500 line-clamp-2">{firstCard.description || 'Sem descrição'}</p>
                    </div>
                )}
            </div>

            {/* Dynamic Buttons - Visual Only in node? Usually specific buttons have handles */}
            {/* If cards have buttons, usually they are generic Next Step or specific. 
                 For simplicity in this visual node, we might just show a "Próximo Passo" or handles for buttons if we want branching per button.
                 Gaio image shows "Próximo passo" at the bottom right.
             */}

            <div className="px-3 pb-3 space-y-2">
                {(firstCard?.buttons || []).map((btn: any, i: number) => (
                    <div key={i} className="w-full p-1.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-md text-[10px] font-bold text-center uppercase tracking-wide truncate">
                        {btn.label || 'Botão'}
                    </div>
                ))}
            </div>

            {/* Main Output Handle */}
            <div className="relative h-10 border-t border-zinc-100 flex items-center justify-end px-3 bg-zinc-50/50 rounded-b-xl">
                <span className="text-[10px] font-medium text-zinc-400 mr-2">Próximo passo</span>
                <Handle
                    type="source"
                    position={Position.Right}
                    id="next"
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

CardsNode.displayName = 'CardsNode';
