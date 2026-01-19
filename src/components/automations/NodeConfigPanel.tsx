
import { X } from 'lucide-react';
import { Node } from 'reactflow';

interface NodeConfigPanelProps {
    node: Node | null;
    onClose: () => void;
    onChange: (nodeId: string, data: any) => void;
}

export default function NodeConfigPanel({ node, onClose, onChange }: NodeConfigPanelProps) {
    if (!node) return null;

    const handleChange = (key: string, value: any) => {
        onChange(node.id, { ...node.data, [key]: value });
    };

    return (
        <aside className="w-80 bg-white border-l border-zinc-200 flex flex-col h-full z-20 shadow-xl absolute right-0 top-0 bottom-0 animation-slide-in-right">
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-zinc-900 text-sm">Configuração</h2>
                    <p className="text-xs text-zinc-500 capitalize">{node.type?.replace('Node', '')}</p>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded text-zinc-400">
                    <X size={16} />
                </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">

                {/* Trigger Config */}
                {node.type === 'triggerNode' && (
                    <>
                        <div>
                            <label className="block text-xs font-semibold text-zinc-700 mb-1">Palavra-Chave</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-zinc-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
                                placeholder="Ex: oi, cupom, dúvida"
                                value={node.data.keyword || ''}
                                onChange={(e) => handleChange('keyword', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-zinc-700 mb-1">Tipo de Correspondência</label>
                            <select
                                className="w-full px-3 py-2 border border-zinc-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
                                value={node.data.matchType || 'contains'}
                                onChange={(e) => handleChange('matchType', e.target.value)}
                            >
                                <option value="contains">Contém</option>
                                <option value="exact">Exato</option>
                            </select>
                        </div>
                    </>
                )}

                {/* Action Config */}
                {node.type === 'actionNode' && (
                    <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">Mensagem de Resposta</label>
                        <textarea
                            className="w-full px-3 py-2 border border-zinc-200 rounded-md text-sm focus:outline-none focus:border-blue-500 h-32 resize-none"
                            placeholder="Digite a mensagem..."
                            value={node.data.message || ''}
                            onChange={(e) => handleChange('message', e.target.value)}
                        />
                    </div>
                )}

                {/* Condition Config */}
                {node.type === 'conditionNode' && (
                    <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">Descrição Lógica</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-zinc-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
                            placeholder="Ex: Usuário segue perfil?"
                            value={node.data.condition || ''}
                            onChange={(e) => handleChange('condition', e.target.value)}
                        />
                    </div>
                )}

            </div>
        </aside>
    );
}
