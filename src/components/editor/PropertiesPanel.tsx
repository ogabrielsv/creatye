import { Node } from 'reactflow';
import { useReactFlow } from 'reactflow';
import { useState, useEffect } from 'react';
import { X, Trash2, Save, PlusCircle } from 'lucide-react';
import {
    NodeDataSchema,
    MessageNodeDataSchema,
    ButtonsNodeDataSchema,
    TagNodeDataSchema,
    WaitNodeDataSchema,
    ConditionNodeDataSchema,
    ButtonItemSchema
} from '@/lib/schemas/nodes';

interface PropertiesPanelProps {
    selectedNode: Node | null;
    onClose: () => void;
    onUpdate: (id: string, data: any) => void;
    onDelete: (id: string) => void;
}

export default function PropertiesPanel({ selectedNode, onClose, onUpdate, onDelete }: PropertiesPanelProps) {
    const [data, setData] = useState<any>({});

    useEffect(() => {
        if (selectedNode) {
            setData({ ...selectedNode.data });
        }
    }, [selectedNode]);

    if (!selectedNode) return null;

    const handleChange = (field: string, value: any) => {
        const newData = { ...data, [field]: value };
        setData(newData);
        // Auto-update or wait for save? 
        // For typical UX, maybe auto update or separate save.
        // Gaio behavior: "salvar em node.data".
        // We'll auto update locally but maybe debounced upstream. 
        // Here we just update the specific block.
        onUpdate(selectedNode.id, newData);
    };

    const handleButtonChange = (index: number, field: string, value: any) => {
        const newButtons = [...(data.buttons || [])];
        newButtons[index] = { ...newButtons[index], [field]: value };
        handleChange('buttons', newButtons);
    };

    const addButton = () => {
        const newButtons = [...(data.buttons || []), { id: crypto.randomUUID(), label: 'Novo Botão', type: 'next' }];
        handleChange('buttons', newButtons);
    };

    const removeButton = (index: number) => {
        const newButtons = [...(data.buttons || [])];
        newButtons.splice(index, 1);
        handleChange('buttons', newButtons);
    }

    return (
        <div className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col h-full overflow-y-auto absolute right-0 top-0 z-20 shadow-xl">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-inherit z-10">
                <h3 className="font-semibold text-lg">Configurar</h3>
                <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="p-4 flex-1 space-y-6">

                {/* Node ID / Type Display */}
                <div className="text-xs text-zinc-400 uppercase font-bold tracking-wider mb-2">
                    Type: {selectedNode.type}
                </div>

                {/* Dynamic Forms based on Type */}

                {selectedNode.type === 'message' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Mensagem</label>
                            <textarea
                                className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 h-32"
                                value={data.message || ''}
                                onChange={(e) => handleChange('message', e.target.value)}
                                placeholder="Digite o texto da mensagem..."
                            />
                        </div>
                    </div>
                )}

                {selectedNode.type === 'buttons' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Mensagem</label>
                            <textarea
                                className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 h-24"
                                value={data.message || ''}
                                onChange={(e) => handleChange('message', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Botões ({data.buttons?.length || 0}/3)</label>
                            <div className="space-y-2">
                                {data.buttons?.map((btn: any, idx: number) => (
                                    <div key={idx} className="p-2 border rounded dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                                        <input
                                            className="w-full p-1 text-sm border-b mb-2 bg-transparent border-zinc-300 dark:border-zinc-600 focus:outline-none"
                                            value={btn.label}
                                            onChange={(e) => handleButtonChange(idx, 'label', e.target.value)}
                                            placeholder="Texto do botão"
                                        />
                                        <select
                                            className="w-full p-1 text-xs bg-transparent border rounded dark:border-zinc-600"
                                            value={btn.type}
                                            onChange={(e) => handleButtonChange(idx, 'type', e.target.value)}
                                        >
                                            <option value="next">Próximo Passo</option>
                                            <option value="link">Abrir Link</option>
                                        </select>
                                        {btn.type === 'link' && (
                                            <input
                                                className="w-full mt-2 p-1 text-xs border rounded bg-transparent dark:border-zinc-600"
                                                value={btn.url || ''}
                                                onChange={(e) => handleButtonChange(idx, 'url', e.target.value)}
                                                placeholder="https://..."
                                            />
                                        )}
                                        <button
                                            onClick={() => removeButton(idx)}
                                            className="text-xs text-red-500 mt-2 hover:underline"
                                        >
                                            Remover
                                        </button>
                                    </div>
                                ))}
                                {(!data.buttons || data.buttons.length < 3) && (
                                    <button
                                        onClick={addButton}
                                        className="w-full py-2 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded text-zinc-500 hover:border-zinc-400 text-sm font-medium"
                                    >
                                        + Adicionar Botão
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Trigger Config */}
                {selectedNode.type === 'triggerNode' && (
                    <div className="space-y-4">
                        <div className="border-l-2 border-purple-500 pl-3">
                            <h4 className="text-sm font-bold text-foreground">Configurar Gatilho</h4>
                            <p className="text-xs text-muted-foreground">Defina como essa automação inicia.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Tipo de Gatilho</label>
                            <select
                                className="w-full text-sm p-2 border rounded bg-background"
                                value={data.triggerType || 'dm_keyword'}
                                onChange={(e) => handleChange('triggerType', e.target.value)}
                            >
                                <option value="dm_keyword">Palavra-chave no Direct (DM)</option>
                                <option value="comment_keyword">Palavra-chave nos Comentários</option>
                                <option value="story_mention">Menção no Story (Qualquer)</option>
                            </select>
                        </div>

                        {(data.triggerType === 'dm_keyword' || data.triggerType === 'comment_keyword' || !data.triggerType) && (
                            <>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Palavra-Chave</label>
                                    <input
                                        type="text"
                                        className="w-full text-sm p-2 border rounded bg-background"
                                        placeholder="Ex: eu quero"
                                        value={data.keyword || ''}
                                        onChange={(e) => handleChange('keyword', e.target.value)}
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Pode ser uma frase ou palavra única.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Correspondência</label>
                                    <select
                                        className="w-full text-sm p-2 border rounded bg-background"
                                        value={data.matchType || 'contains'}
                                        onChange={(e) => handleChange('matchType', e.target.value)}
                                    >
                                        <option value="contains">Contém a palavra</option>
                                        <option value="exact">É exatamente a palavra</option>
                                    </select>
                                </div>
                            </>
                        )}

                        {data.triggerType === 'comment_keyword' && (
                            <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded border border-blue-100">
                                💡 A automação responderá ao comentário publicamente (se configurado) ou enviará um Direct.
                                Certifique-se de conectar a ação desejada.
                            </div>
                        )}
                    </div>
                )}

                {/* Cards / Carousel Config */}
                {selectedNode.type === 'cards' && (
                    <div className="space-y-6">
                        <div className="border-l-2 border-brand-500 pl-3">
                            <h4 className="text-sm font-bold text-foreground">Gerenciar Cartões</h4>
                            <p className="text-xs text-muted-foreground">Adicione e edite os cards do carrossel.</p>
                        </div>

                        {(data.cards || []).map((card: any, cIdx: number) => (
                            <div key={card.id || cIdx} className="border border-border rounded-lg p-3 bg-zinc-50 dark:bg-zinc-800/50 relative group">
                                <div className="absolute top-2 right-2">
                                    <button
                                        onClick={() => {
                                            const newCards = [...(data.cards || [])];
                                            newCards.splice(cIdx, 1);
                                            handleChange('cards', newCards);
                                        }}
                                        className="text-red-500 p-1 hover:bg-red-50 rounded"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {/* Image */}
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground">Imagem URL</label>
                                        <input
                                            className="w-full text-xs p-2 border rounded bg-background"
                                            placeholder="https://..."
                                            value={card.image || ''}
                                            onChange={(e) => {
                                                const newCards = [...(data.cards || [])];
                                                newCards[cIdx] = { ...card, image: e.target.value };
                                                handleChange('cards', newCards);
                                            }}
                                        />
                                    </div>

                                    {/* Title */}
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground">Título</label>
                                        <input
                                            className="w-full text-sm p-2 border rounded bg-background font-medium"
                                            placeholder="Título do card..."
                                            value={card.title || ''}
                                            onChange={(e) => {
                                                const newCards = [...(data.cards || [])];
                                                newCards[cIdx] = { ...card, title: e.target.value };
                                                handleChange('cards', newCards);
                                            }}
                                        />
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground">Descrição</label>
                                        <textarea
                                            className="w-full text-xs p-2 border rounded bg-background resize-none h-16"
                                            placeholder="Descrição do card..."
                                            value={card.description || ''}
                                            onChange={(e) => {
                                                const newCards = [...(data.cards || [])];
                                                newCards[cIdx] = { ...card, description: e.target.value };
                                                handleChange('cards', newCards);
                                            }}
                                        />
                                    </div>

                                    {/* Buttons for this Card */}
                                    <div className="pt-2 border-t border-border">
                                        <label className="text-xs font-bold text-muted-foreground mb-2 block">Botões ({card.buttons?.length || 0}/3)</label>
                                        <div className="space-y-2">
                                            {(card.buttons || []).map((btn: any, bIdx: number) => (
                                                <div key={bIdx} className="flex gap-2 items-center">
                                                    <input
                                                        className="flex-1 text-xs p-1.5 border rounded bg-background"
                                                        value={btn.label}
                                                        onChange={(e) => {
                                                            const newCards = [...(data.cards || [])];
                                                            const newButtons = [...(card.buttons || [])];
                                                            newButtons[bIdx] = { ...btn, label: e.target.value };
                                                            newCards[cIdx] = { ...card, buttons: newButtons };
                                                            handleChange('cards', newCards);
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const newCards = [...(data.cards || [])];
                                                            const newButtons = [...(card.buttons || [])];
                                                            newButtons.splice(bIdx, 1);
                                                            newCards[cIdx] = { ...card, buttons: newButtons };
                                                            handleChange('cards', newCards);
                                                        }}
                                                        className="text-red-400 hover:text-red-600"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                            {(card.buttons?.length || 0) < 3 && (
                                                <button
                                                    onClick={() => {
                                                        const newCards = [...(data.cards || [])];
                                                        const newButtons = [...(card.buttons || []), { label: 'Botão', type: 'next' }];
                                                        newCards[cIdx] = { ...card, buttons: newButtons };
                                                        handleChange('cards', newCards);
                                                    }}
                                                    className="w-full py-1 text-xs border border-dashed rounded text-muted-foreground hover:bg-zinc-50"
                                                >
                                                    + Botão
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={() => {
                                const newCards = [...(data.cards || []), { id: crypto.randomUUID(), title: 'Novo Card', buttons: [] }];
                                handleChange('cards', newCards);
                            }}
                            className="w-full py-2 bg-brand-50 text-brand-600 font-bold border border-brand-200 rounded-lg hover:bg-brand-100 transition-colors flex items-center justify-center gap-2"
                        >
                            <PlusCircle size={16} />
                            Adicionar Cartão
                        </button>
                    </div>
                )}

                {(selectedNode.type === 'add_tag' || selectedNode.type === 'remove_tag' || selectedNode.type === 'condition') && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Tag</label>
                            <input
                                className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                                value={data.tag || ''}
                                onChange={(e) => handleChange('tag', e.target.value)}
                                placeholder="Ex: LEAD_QUENTE"
                            />
                            <p className="text-xs text-zinc-500 mt-1">
                                Digite a tag que será usada.
                            </p>
                        </div>
                    </div>
                )}

                {selectedNode.type === 'wait' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Aguardar (segundos)</label>
                            <input
                                type="number"
                                className="w-full p-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                                value={data.delaySeconds || 0}
                                onChange={(e) => handleChange('delaySeconds', parseInt(e.target.value))}
                                min={1}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                    onClick={() => onDelete(selectedNode.id)}
                    className="flex items-center justify-center gap-2 w-full py-2 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                    Deletar Bloco
                </button>
            </div>
        </div>
    );
}
