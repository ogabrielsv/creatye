'use client';

import { useEffect, useState } from 'react';
import { Automation, Folder as FolderType } from '@/../creatye-core/automation/types';
import { AutomationList } from '@/components/automations/AutomationList';
import { Plus, Search, Folder, Trash2, Instagram, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type FilterStatus = 'all' | 'published' | 'draft';

export default function AutomationsPage() {
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [folders, setFolders] = useState<FolderType[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [fetchError, setFetchError] = useState(false);

    // Modal State
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);

    const router = useRouter();
    const debouncedSearch = useDebounce(searchQuery, 300);

    useEffect(() => {
        checkConnection();
        fetchFolders();
    }, []);

    useEffect(() => {
        if (isConnected !== false) {
            fetchAutomations();
        }
    }, [statusFilter, selectedFolderId, debouncedSearch, isConnected]);

    async function checkConnection() {
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('ig_connections')
                    .select('access_token')
                    .eq('user_id', user.id)
                    .maybeSingle();

                setIsConnected(!!data);
            }
        } catch (e) {
            console.error(e);
            setIsConnected(false);
        }
    }

    async function fetchFolders() {
        try {
            const res = await fetch('/api/folders');
            if (res.ok) {
                const data = await res.json();
                setFolders(data);
            }
        } catch (e) {
            console.error('Failed to fetch folders', e);
        }
    }

    async function fetchAutomations() {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (selectedFolderId) params.append('folder_id', selectedFolderId);
            if (debouncedSearch) params.append('q', debouncedSearch);

            const res = await fetch(`/api/automations?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setAutomations(data);
            }
        } catch (error) {
            console.error(error);
            setFetchError(true);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateFolder() {
        if (!newFolderName.trim()) return;
        setCreatingFolder(true);
        try {
            const res = await fetch('/api/folders', {
                method: 'POST',
                body: JSON.stringify({ name: newFolderName }),
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                const newFolder = await res.json();
                setFolders(prev => [newFolder, ...prev]);
                setIsFolderModalOpen(false);
                setNewFolderName('');
            } else {
                const err = await res.json();
                alert(err.error || 'Erro ao criar pasta');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setCreatingFolder(false);
        }
    }

    async function handleDeleteFolder(id: string, e: React.MouseEvent) {
        e.stopPropagation();
        if (!confirm('Tem certeza que deseja excluir esta pasta? As automações voltarão para a raiz.')) return;

        try {
            alert('Funcionalidade de exclusão em breve.');
        } catch (error) {
            console.error(error);
        }
    }

    function handleCreateAutomation() {
        router.push('/automations/create');
    }

    const currentFolderName = selectedFolderId
        ? folders.find(f => f.id === selectedFolderId)?.name || 'Pasta'
        : 'Todas';

    if (isConnected === null) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!isConnected) {
        return (
            <div className="p-8 max-w-7xl mx-auto min-h-screen flex flex-col items-center justify-center text-center">
                {/* ... (existing connect UI) ... */}
                <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl max-w-md w-full shadow-2xl">
                    <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Instagram className="w-8 h-8 text-brand-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Conecte o Instagram</h2>
                    <p className="text-zinc-400 mb-8">
                        Para acessar suas automações, você precisa conectar uma conta do Instagram Business.
                    </p>
                    <button
                        onClick={() => window.location.href = '/api/meta/connect'}
                        className="w-full py-3 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 hover:opacity-90 shadow-lg"
                        style={{
                            background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)'
                        }}
                    >
                        <Instagram className="w-5 h-5" />
                        Conectar com Instagram
                    </button>
                </div>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="p-8 max-w-7xl mx-auto min-h-screen flex flex-col items-center justify-center text-center">
                <div className="text-red-500 mb-4 font-bold text-xl">Erro ao carregar automações</div>
                <p className="text-zinc-400 mb-4">
                    Pode haver um problema com o banco de dados (tabelas ausentes?).
                    <br />Verifique se as migrações foram aplicadas.
                </p>
                <button
                    onClick={() => { setFetchError(false); fetchAutomations(); }}
                    className="px-4 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700"
                >
                    Tentar Novamente
                </button>
            </div>
        )
    }

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Automações</h1>
                    <p className="text-muted-foreground mt-1">Gerencie seus fluxos de conversa e atendimento.</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={async () => {
                            if (!confirm('Criar automação de TESTE (oi->aprovado)?')) return;
                            const res = await fetch('/api/debug/create-test-automation', { method: 'POST' });
                            const data = await res.json();
                            if (data.success) {
                                alert('Automação criada!');
                                router.refresh();
                                fetchAutomations();
                            } else {
                                alert('Erro: ' + JSON.stringify(data));
                            }
                        }}
                        className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold rounded-lg border border-red-500/20 text-xs"
                    >
                        Criar Teste (1-click)
                    </button>
                    <button
                        onClick={() => setIsFolderModalOpen(true)}
                        className="px-4 py-2 bg-background border border-border text-foreground font-medium rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                    >
                        <Folder size={18} />
                        Nova Pasta
                    </button>
                    <button
                        onClick={handleCreateAutomation}
                        className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-zinc-950 font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-brand-500/20"
                    >
                        <Plus size={18} />
                        Nova Automação
                    </button>
                </div>
            </div>

            {folders.length > 0 && (
                <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button
                        onClick={() => setSelectedFolderId(null)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${selectedFolderId === null
                            ? 'bg-brand-50 dark:bg-brand-950/30 border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300'
                            : 'bg-background border-border text-muted-foreground hover:bg-secondary'
                            }`}
                    >
                        <Folder size={14} className={selectedFolderId === null ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground"} />
                        Todas
                    </button>
                    {folders.map(folder => (
                        <div
                            key={folder.id}
                            onClick={() => setSelectedFolderId(folder.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap cursor-pointer group ${selectedFolderId === folder.id
                                ? 'bg-brand-50 dark:bg-brand-950/30 border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300'
                                : 'bg-background border-border text-muted-foreground hover:bg-secondary'
                                }`}
                        >
                            <Folder size={14} className={selectedFolderId === folder.id ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground"} />
                            <span>{folder.name}</span>
                            {/* Deleted trash icon for now */}
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
                <div className="relative flex-1 w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar automação..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                    />
                </div>

                <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg self-start md:self-auto">
                    {(['all', 'published', 'draft'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${statusFilter === status
                                ? 'bg-white dark:bg-zinc-600 text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
                                }`}
                        >
                            {status === 'all' ? 'Todos' : status === 'published' ? 'Publicados' : 'Rascunhos'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1">
                {selectedFolderId && (
                    <div className="mb-4 text-sm text-muted-foreground flex items-center gap-2">
                        <span>Pasta: <span className="font-semibold text-foreground">{currentFolderName}</span></span>
                        <span className="w-1 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
                        <span>{automations.length} automações</span>
                    </div>
                )}

                <AutomationList
                    automations={automations}
                    loading={loading}
                    onCreateClick={handleCreateAutomation}
                />
            </div>

            {isFolderModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-foreground">Criar Nova Pasta</h3>
                            <button
                                onClick={() => setIsFolderModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">
                                    Nome da Pasta
                                </label>
                                <input
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    placeholder="Ex: Campanhas de Natal"
                                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3 justify-end mt-6">
                                <button
                                    onClick={() => setIsFolderModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                    disabled={creatingFolder}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreateFolder}
                                    className="px-4 py-2 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-lg shadow-sm transition-all flex items-center gap-2"
                                    disabled={creatingFolder || !newFolderName.trim()}
                                >
                                    {creatingFolder ? 'Criando...' : 'Criar Pasta'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}
