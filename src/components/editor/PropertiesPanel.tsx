import { Node } from 'reactflow';
import { useReactFlow } from 'reactflow';
import { useState, useEffect } from 'react';
import { X, Trash2, Save } from 'lucide-react';
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
