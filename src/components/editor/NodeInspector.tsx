import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Image as ImageIcon } from 'lucide-react';

export function NodeInspector({ selectedNode, updateNodeData, onClose }: any) {
    const [data, setData] = useState(selectedNode?.data || {});

    useEffect(() => {
        setData(selectedNode?.data || {});
    }, [selectedNode]);

    const handleChange = (field: string, value: any) => {
        const newData = { ...data, [field]: value };
        setData(newData);
        updateNodeData(selectedNode.id, newData);
    };

    if (!selectedNode) return null;

    // Helper for Cards
    const handleCardChange = (idx: number, field: string, value: any) => {
        const cards = [...(data.cards || [])];
        if (!cards[idx]) cards[idx] = {};
        cards[idx][field] = value;
        handleChange('cards', cards);
    };

    const addCard = () => {
        const cards = [...(data.cards || [])];
        cards.push({ title: 'Novo Card', description: '', buttons: [] });
        handleChange('cards', cards);
    };

    const removeCard = (idx: number) => {
        const cards = [...(data.cards || [])].filter((_, i) => i !== idx);
        handleChange('cards', cards);
    };

    return (
        <aside className="w-[400px] bg-white border-l border-zinc-200 flex flex-col h-full shadow-2xl z-20 absolute right-0 top-0 bottom-0 overflow-hidden font-sans">
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b border-zinc-100 flex justify-between items-center shadow-sm z-10">
                <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">Editor</span>
                    <h2 className="font-bold text-lg text-zinc-800">{getNodeTitle(selectedNode.type)}</h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-zinc-50 rounded-full text-zinc-400 hover:text-zinc-600 transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-zinc-50/30">
                <div className="p-6 space-y-8">

                    {/* --- CONFIG: MESSAGE / BUTTONS --- */}
                    {['message', 'buttons'].includes(selectedNode.type) && (
                        <div className="space-y-6">
                            <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-3">Mensagem</label>
                                <textarea
                                    value={data.content || ''}
                                    onChange={(e) => handleChange('content', e.target.value)}
                                    className="w-full h-32 p-3 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none transition-all placeholder:text-zinc-400 text-zinc-800 font-medium"
                                    placeholder="Digite o texto da mensagem..."
                                />
                                <div className="flex justify-between items-center mt-2 text-[10px] text-zinc-400">
                                    <span>Suporta variáveis {'{...}'}</span>
                                    <span>{data.content?.length || 0} / 1000</span>
                                </div>
                            </div>

                            {selectedNode.type === 'buttons' && (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-end">
                                        <label className="text-xs font-bold text-zinc-700 uppercase">Botões</label>
                                    </div>

                                    <div className="space-y-3">
                                        {(data.buttons || []).map((btn: any, idx: number) => (
                                            <div key={idx} className="bg-white p-3 rounded-lg border border-zinc-200 shadow-sm group transition-all hover:border-blue-300 hover:shadow-md">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <input
                                                        value={btn.label}
                                                        onChange={(e) => {
                                                            const newBtns = [...data.buttons];
                                                            newBtns[idx].label = e.target.value;
                                                            handleChange('buttons', newBtns);
                                                        }}
                                                        placeholder="Nome do botão"
                                                        className="flex-1 px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:border-blue-500 outline-none text-zinc-800 font-medium"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const newBtns = data.buttons.filter((_: any, i: number) => i !== idx);
                                                            handleChange('buttons', newBtns);
                                                        }}
                                                        className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>

                                                {/* External Link Toggle */}
                                                <div>
                                                    <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                                            checked={btn.type === 'web_url'}
                                                            onChange={(e) => {
                                                                const newBtns = [...data.buttons];
                                                                newBtns[idx].type = e.target.checked ? 'web_url' : 'post_back';
                                                                if (!e.target.checked) delete newBtns[idx].url; // cleanup
                                                                handleChange('buttons', newBtns);
                                                            }}
                                                        />
                                                        <span className="text-xs text-zinc-600 font-medium">Link externo</span>
                                                    </label>

                                                    {/* URL Input (Conditional) */}
                                                    {btn.type === 'web_url' && (
                                                        <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                            <input
                                                                value={btn.url || ''}
                                                                onChange={(e) => {
                                                                    const newBtns = [...data.buttons];
                                                                    newBtns[idx].url = e.target.value;
                                                                    handleChange('buttons', newBtns);
                                                                }}
                                                                placeholder="https://exemplo.com"
                                                                className="w-full px-3 py-2 text-xs bg-blue-50/50 border border-blue-100 rounded-lg text-blue-700 placeholder:text-blue-300 focus:ring-1 focus:ring-blue-500 outline-none"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newBtns = [...(data.buttons || []), { id: crypto.randomUUID(), label: 'Novo Botão', type: 'post_back' }];
                                            handleChange('buttons', newBtns);
                                        }}
                                        className="w-full py-3 bg-blue-50 border border-blue-100 text-blue-600 font-bold text-xs rounded-lg hover:bg-blue-100 transition-colors uppercase tracking-wide flex items-center justify-center gap-2"
                                    >
                                        <Plus size={14} />
                                        Adicionar Botão
                                    </button>
                                </div>
                            )}
                        </div>
                    )}


                    {/* --- CONFIG: CARDS --- */}
                    {selectedNode.type === 'cards' && (
                        <div className="space-y-6">
                            {(data.cards?.length > 0) ? (
                                data.cards.map((card: any, idx: number) => (
                                    <div key={idx} className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm relative group overflow-hidden">
                                        <div className="flex justify-between items-center mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-zinc-100 text-zinc-500 text-[10px] font-bold px-2 py-0.5 rounded">
                                                    {idx + 1}/{data.cards.length}
                                                </span>
                                                <span className="text-sm font-bold text-zinc-700">Cartão</span>
                                            </div>
                                            <button onClick={() => removeCard(idx)} className="text-zinc-300 hover:text-red-500 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Image Upload Placeholder */}
                                            <div className="w-full h-32 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-lg flex flex-col items-center justify-center text-zinc-400 hover:border-blue-300 hover:text-blue-500 transition-colors cursor-pointer group/upload relative overflow-hidden">
                                                {card.image ? (
                                                    <img src={card.image} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                                                ) : (
                                                    <>
                                                        <ImageIcon size={24} className="mb-2 group-hover/upload:scale-110 transition-transform" />
                                                        <span className="text-xs font-medium">Upload da Imagem</span>
                                                    </>
                                                )}

                                                {/* Fake Upload Click */}
                                                <input
                                                    type="file"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    onChange={(e) => {
                                                        if (e.target.files?.[0]) {
                                                            const fakeUrl = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3';
                                                            handleCardChange(idx, 'image', fakeUrl);
                                                        }
                                                    }}
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Título</label>
                                                <input
                                                    value={card.title || ''}
                                                    onChange={(e) => handleCardChange(idx, 'title', e.target.value)}
                                                    className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:border-blue-500 outline-none font-medium text-zinc-800"
                                                    placeholder="Título do card"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Descrição</label>
                                                <textarea
                                                    value={card.description || ''}
                                                    onChange={(e) => handleCardChange(idx, 'description', e.target.value)}
                                                    className="w-full h-20 p-3 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:border-blue-500 outline-none resize-none font-medium text-zinc-800"
                                                    placeholder="Descrição..."
                                                />
                                            </div>

                                            {/* Card Buttons */}
                                            <div className="space-y-2 pt-2 border-t border-zinc-100">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Botões do Cartão</label>
                                                </div>

                                                {(card.buttons || []).map((btn: any, btnIdx: number) => (
                                                    <div key={btnIdx} className="bg-zinc-50 p-2 rounded-lg border border-zinc-200 flex flex-col gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                value={btn.label}
                                                                onChange={(e) => {
                                                                    const newCards = [...data.cards];
                                                                    newCards[idx].buttons[btnIdx].label = e.target.value;
                                                                    handleChange('cards', newCards);
                                                                }}
                                                                className="flex-1 px-2 py-1 text-xs bg-white border border-zinc-200 rounded focus:border-blue-500 outline-none"
                                                                placeholder="Nome do botão"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    const newCards = [...data.cards];
                                                                    newCards[idx].buttons = newCards[idx].buttons.filter((_: any, i: number) => i !== btnIdx);
                                                                    handleChange('cards', newCards);
                                                                }}
                                                                className="text-zinc-300 hover:text-red-500 p-1"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                        {/* Card Button External Link */}
                                                        <div>
                                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                                <input
                                                                    type="checkbox"
                                                                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                                                                    checked={btn.type === 'web_url'}
                                                                    onChange={(e) => {
                                                                        const newCards = [...data.cards];
                                                                        newCards[idx].buttons[btnIdx].type = e.target.checked ? 'web_url' : 'post_back';
                                                                        if (!e.target.checked) delete newCards[idx].buttons[btnIdx].url;
                                                                        handleChange('cards', newCards);
                                                                    }}
                                                                />
                                                                <span className="text-[10px] text-zinc-600">Link externo</span>
                                                            </label>
                                                            {btn.type === 'web_url' && (
                                                                <input
                                                                    value={btn.url || ''}
                                                                    onChange={(e) => {
                                                                        const newCards = [...data.cards];
                                                                        newCards[idx].buttons[btnIdx].url = e.target.value;
                                                                        handleChange('cards', newCards);
                                                                    }}
                                                                    placeholder="https://"
                                                                    className="w-full mt-1 px-2 py-1 text-[10px] text-blue-600 bg-blue-50 border border-blue-100 rounded focus:border-blue-500 outline-none"
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}

                                                <button
                                                    onClick={() => {
                                                        const newCards = [...data.cards];
                                                        if (!newCards[idx].buttons) newCards[idx].buttons = [];
                                                        newCards[idx].buttons.push({ id: crypto.randomUUID(), label: 'Botão', type: 'post_back' });
                                                        handleChange('cards', newCards);
                                                    }}
                                                    className="w-full py-2 bg-white border border-dashed border-blue-300 text-blue-500 font-bold text-[10px] rounded-lg hover:bg-blue-50 transition-colors uppercase"
                                                >
                                                    + Adicionar Botão
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10">
                                    <p className="text-sm text-zinc-400">Nenhum cartão criado.</p>
                                </div>
                            )}

                            {/* Add Card Button */}
                            <div className="pt-2">
                                <button
                                    onClick={addCard}
                                    className="w-full py-3 bg-blue-50 border border-blue-100 text-blue-600 font-bold text-xs rounded-lg hover:bg-blue-100 transition-colors uppercase tracking-wide flex items-center justify-center gap-2"
                                >
                                    <Plus size={14} />
                                    Adicionar Novo Cartão
                                </button>
                            </div>
                        </div>
                    )}


                    {/* --- CONFIG: WAIT --- */}
                    {selectedNode.type === 'wait' && (
                        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-4">Aguardar antes de iniciar</label>

                            <div className="flex items-center gap-2 justify-center py-4 bg-zinc-50 rounded-lg border border-zinc-100">
                                {/* Hours */}
                                <div className="flex flex-col items-center">
                                    <input
                                        type="number"
                                        min="0"
                                        max="24"
                                        value={data.hours || 0}
                                        onChange={(e) => handleChange('hours', parseInt(e.target.value) || 0)}
                                        className="w-16 h-12 text-center text-xl font-bold bg-white border border-zinc-200 rounded-lg focus:border-blue-500 outline-none text-zinc-800"
                                    />
                                    <span className="text-[10px] uppercase font-bold text-zinc-400 mt-2">Horas</span>
                                </div>
                                <span className="text-xl font-bold text-zinc-300 -mt-6">:</span>

                                {/* Minutes */}
                                <div className="flex flex-col items-center">
                                    <input
                                        type="number"
                                        min="0"
                                        max="59"
                                        value={data.minutes || 0}
                                        onChange={(e) => handleChange('minutes', parseInt(e.target.value) || 0)}
                                        className="w-16 h-12 text-center text-xl font-bold bg-white border border-zinc-200 rounded-lg focus:border-blue-500 outline-none text-zinc-800"
                                    />
                                    <span className="text-[10px] uppercase font-bold text-zinc-400 mt-2">Minutos</span>
                                </div>
                                <span className="text-xl font-bold text-zinc-300 -mt-6">:</span>

                                {/* Seconds */}
                                <div className="flex flex-col items-center">
                                    <input
                                        type="number"
                                        min="0"
                                        max="59"
                                        value={data.seconds || 0}
                                        onChange={(e) => handleChange('seconds', parseInt(e.target.value) || 0)}
                                        className="w-16 h-12 text-center text-xl font-bold bg-white border border-zinc-200 rounded-lg focus:border-blue-500 outline-none text-zinc-800"
                                    />
                                    <span className="text-[10px] uppercase font-bold text-zinc-400 mt-2">Segundos</span>
                                </div>
                            </div>
                            <p className="text-xs text-zinc-400 mt-3 text-center px-4 leading-relaxed">
                                Selecione um tempo no formato horas, minutos e segundos.
                            </p>
                        </div>
                    )}

                    {/* --- CONFIG: TAGS --- */}
                    {['add_tag', 'remove_tag'].includes(selectedNode.type) && (
                        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm space-y-6">

                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-2">Tipo de Ação</label>
                                <div className="flex p-1 bg-zinc-100 rounded-lg">
                                    <button
                                        onClick={() => handleChange('action', 'add')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${(!data.action || data.action === 'add') ? 'bg-white shadow text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}
                                    >
                                        Adicionar
                                    </button>
                                    <button
                                        onClick={() => handleChange('action', 'remove')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${data.action === 'remove' ? 'bg-white shadow text-red-600' : 'text-zinc-500 hover:text-zinc-700'}`}
                                    >
                                        Remover
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-2">Selecionar Etiquetas</label>
                                <div className="space-y-2">
                                    {/* Tag Input Placeholder - in real app would be async select */}
                                    <input
                                        placeholder="Digite o nome da tag..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.currentTarget.value;
                                                if (val) {
                                                    const newTags = [...(data.tags || []), val];
                                                    handleChange('tags', newTags);
                                                    e.currentTarget.value = '';
                                                }
                                            }
                                        }}
                                        className="w-full px-3 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:border-blue-500 outline-none text-zinc-800"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        {(data.tags || []).map((tag: string, i: number) => (
                                            <span key={i} className={`px-2 py-1 rounded text-xs font-medium border flex items-center gap-1 ${(data.action === 'remove') ? 'bg-red-50 text-red-600 border-red-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                                }`}>
                                                {tag}
                                                <button onClick={() => {
                                                    const newTags = data.tags.filter((_: any, idx: number) => idx !== i);
                                                    handleChange('tags', newTags);
                                                }}>
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-zinc-200 bg-white shadow-up z-10">
                <p className="text-[10px] text-zinc-400 text-center mb-3">
                    Por favor, preencha todos os campos obrigatórios corretamente.
                </p>
                <div className="flex gap-2">
                    {/* <button className="flex-1 py-3 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                        Salvar Alterações
                    </button> */}
                    {/* Auto-save implies no big button needed, but maybe for UX closure */}
                </div>
            </div>
        </aside>
    );
}

function getNodeTitle(type: string) {
    switch (type) {
        case 'start': return 'Início';
        case 'message': return 'Mensagem de Texto';
        case 'buttons': return 'Botões';
        case 'cards': return 'Carrossel';
        case 'wait': return 'Aguardar';
        case 'add_tag': return 'Adicionar Tag';
        case 'remove_tag': return 'Remover Tag';
        case 'condition_tag': return 'Condicional';
        default: return type;
    }
}
