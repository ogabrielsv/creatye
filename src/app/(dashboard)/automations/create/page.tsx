'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Folder, X } from 'lucide-react';
import Link from 'next/link';

// Local definitions to ensure stability
const CHANNEL_LIST = ['dm', 'comment_feed', 'comment_live', 'story_mention', 'story_reply'];
const CHANNELS: Record<string, { label: string }> = {
    dm: { label: 'Mensagem Direta' },
    comment_feed: { label: 'Comentário no Feed' },
    comment_live: { label: 'Comentário em Live' },
    story_mention: { label: 'Menção à Story' },
    story_reply: { label: 'Resposta à Story' }
};

const MATCH_TYPES = {
    contains: 'Contém a palavra',
    exact: 'É igual a palavra',
    starts_with: 'Começa com'
};

const POST_OPTIONS = {
    any_post: 'Qualquer publicação',
    specific_post: 'Publicação específica'
};

interface TriggerConfig {
    keywords: string[];
    matchType: 'contains' | 'exact' | 'starts_with';
    postOption: 'any_post' | 'specific_post';
}

export default function CreateAutomationPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

    // Trigger Configuration State
    const [triggerConfig, setTriggerConfig] = useState<TriggerConfig>({
        keywords: [],
        matchType: 'contains',
        postOption: 'any_post'
    });
    const [keywordInput, setKeywordInput] = useState('');

    // Folders State
    const [folders, setFolders] = useState<{ id: string | null, name: string }[]>([{ id: null, name: 'Raiz (Sem Pasta)' }]);
    const [folderId, setFolderId] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState('');

    useEffect(() => {
        // Fetch folders
        fetch('/api/folders')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setFolders([{ id: null, name: 'Raiz (Sem Pasta)' }, ...data]);
                }
            })
            .catch(console.error);
    }, []);

    const handleChannelToggle = (channelId: string) => {
        setSelectedChannels(prev =>
            prev.includes(channelId)
                ? prev.filter(c => c !== channelId)
                : [...prev, channelId]
        );
    };

    const addKeyword = () => {
        if (keywordInput.trim() && !triggerConfig.keywords.includes(keywordInput.trim())) {
            setTriggerConfig(prev => ({
                ...prev,
                keywords: [...prev.keywords, keywordInput.trim()]
            }));
            setKeywordInput('');
        }
    };

    const removeKeyword = (kw: string) => {
        setTriggerConfig(prev => ({
            ...prev,
            keywords: prev.keywords.filter(k => k !== kw)
        }));
    };

    const handleCreate = async (status: 'draft' | 'published' = 'draft') => {
        if (!name.trim()) {
            alert('O título é obrigatório.');
            return;
        }
        if (selectedChannels.length === 0) {
            alert('Selecione pelo menos um canal de funcionamento.');
            return;
        }
        if (status === 'published' && !actionMessage.trim()) {
            alert('Para publicar, a mensagem de resposta é obrigatória.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/automations', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    description,
                    folder_id: folderId,
                    channels: selectedChannels,
                    trigger_config: triggerConfig,
                    action_config: {
                        message: actionMessage
                    },
                    status: status
                }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                router.push('/automations');
            } else {
                const err = await res.json();
                alert(`Erro: ${err.error}`);
            }
        } catch (e) {
            console.error(e);
            alert('Erro ao criar automação.');
        } finally {
            setLoading(false);
        }
    };

    // Show keyword config for relevant channels
    const showKeywordConfig = selectedChannels.some(c => ['dm', 'comment_feed', 'comment_live', 'story_reply'].includes(c));

    // Show post config for feed/live comments
    const showPostConfig = selectedChannels.some(c => ['comment_feed', 'comment_live'].includes(c));

    return (
        <div className="min-h-screen bg-zinc-50 flex flex-col">
            {/* Header */}
            <div className="h-16 bg-white border-b border-zinc-200 flex items-center px-4 md:px-8">
                <div className="flex items-center gap-3 text-sm text-zinc-500">
                    <Link href="/automations" className="hover:text-zinc-900 transition-colors">Automações</Link>
                    <span>/</span>
                    <span className="font-semibold text-zinc-900">Criar</span>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 md:p-8">
                <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-zinc-200 p-6 md:p-8">

                    {/* Title */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-zinc-900 mb-2">
                            Título
                        </label>
                        <input
                            type="text"
                            placeholder="Dê um título a sua automação"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-zinc-900 placeholder:text-zinc-400"
                        />
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-zinc-900 mb-2">
                            Descrição (Opcional)
                        </label>
                        <textarea
                            placeholder="Descrição da automação"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full h-32 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-zinc-900 placeholder:text-zinc-400 resize-none"
                        />
                    </div>

                    {/* Folder */}
                    <div className="mb-8">
                        <label className="block text-sm font-semibold text-zinc-900 mb-2">
                            Pasta (Opcional)
                        </label>
                        <div className="relative">
                            <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <select
                                className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg appearance-none text-zinc-900 focus:outline-none focus:border-blue-500"
                                onChange={(e) => setFolderId(e.target.value || null)}
                            >
                                {folders.map((f: any) => (
                                    <option key={f.id || 'root'} value={f.id || ''}>
                                        {f.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Channels */}
                    <div className="mb-8">
                        <label className="block text-sm font-semibold text-zinc-900 mb-1">
                            Onde a sua automação deverá funcionar?
                        </label>
                        <p className="text-xs text-zinc-500 mb-4">
                            Selecione um ou mais canais onde sua automação irá funcionar
                        </p>

                        <div className="flex flex-wrap gap-4">
                            {CHANNEL_LIST.map(cid => {
                                const isSelected = selectedChannels.includes(cid);
                                return (
                                    <button
                                        key={cid}
                                        type="button"
                                        onClick={() => handleChannelToggle(cid)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all select-none ${isSelected
                                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                                            : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-zinc-300'
                                            }`}>
                                            {isSelected && <Check size={12} className="text-white" />}
                                        </div>
                                        <span className="text-sm font-medium">{CHANNELS[cid].label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Keywords Config */}
                    {showKeywordConfig && (
                        <div className="mb-10 animation-fade-in">
                            <label className="block text-sm font-semibold text-zinc-900 mb-1">
                                Quais palavras-chave ativarão essa automação?
                            </label>
                            <div className="flex flex-col md:flex-row gap-4 mt-3">
                                <div className="w-48 flex-shrink-0">
                                    <select
                                        value={triggerConfig.matchType}
                                        onChange={(e) => setTriggerConfig({ ...triggerConfig, matchType: e.target.value as any })}
                                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    >
                                        {Object.entries(MATCH_TYPES).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-1 relative">
                                    <div className="flex flex-wrap gap-2 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 min-h-[48px] items-center">
                                        {triggerConfig.keywords.map(kw => (
                                            <span key={kw} className="bg-white border border-zinc-200 shadow-sm px-2 py-1 rounded text-sm font-medium flex items-center gap-1 text-zinc-700">
                                                {kw}
                                                <button onClick={() => removeKeyword(kw)} className="text-zinc-400 hover:text-red-500"><X size={14} /></button>
                                            </span>
                                        ))}
                                        <input
                                            type="text"
                                            value={keywordInput}
                                            onChange={(e) => setKeywordInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                                            placeholder={triggerConfig.keywords.length === 0 ? "Crie uma palavra-chave..." : ""}
                                            className="flex-1 min-w-[120px] outline-none text-sm bg-transparent text-zinc-900 placeholder:text-zinc-400"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Post Selection */}
                    {showPostConfig && (
                        <div className="mb-8 p-6 bg-zinc-50 rounded-xl border border-zinc-200 animation-fade-in">
                            <label className="block text-sm font-semibold text-zinc-900 mb-1">
                                Selecione um post
                            </label>
                            <select
                                value={triggerConfig.postOption}
                                onChange={(e) => setTriggerConfig({ ...triggerConfig, postOption: e.target.value as any })}
                                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                                {Object.entries(POST_OPTIONS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Action Config */}
                    <div className="mb-8">
                        <label className="block text-sm font-semibold text-zinc-900 mb-2">
                            Mensagem de Resposta
                        </label>
                        <textarea
                            placeholder="Digite a mensagem que será enviada..."
                            value={actionMessage}
                            onChange={e => setActionMessage(e.target.value)}
                            className="w-full h-32 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-zinc-900 placeholder:text-zinc-400 resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-6 border-t border-zinc-100">
                        <button
                            onClick={() => handleCreate('draft')}
                            disabled={loading}
                            className={`px-6 py-2.5 bg-white border border-zinc-300 text-zinc-700 font-medium rounded-lg hover:bg-zinc-50 transition-all ${loading ? 'opacity-70 cursor-not-allowed' : ''
                                }`}
                        >
                            Salvar como Rascunho
                        </button>
                        <button
                            onClick={() => handleCreate('published')}
                            disabled={loading}
                            className={`px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg shadow-sm shadow-blue-600/20 transition-all ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'
                                }`}
                        >
                            {loading ? 'Salvando...' : 'Publicar'}
                        </button>
                        <button
                            onClick={() => router.back()}
                            className="px-6 py-2.5 text-zinc-500 font-medium rounded-lg hover:text-zinc-700 transition-colors ml-auto"
                        >
                            Cancelar
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
