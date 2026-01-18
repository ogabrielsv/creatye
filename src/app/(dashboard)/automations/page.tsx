'use client';

import { useEffect, useState } from 'react';
import { Automation, Folder as FolderType } from '@/../creatye-core/automation/types';
import { AutomationList } from '@/components/automations/AutomationList';
import { Plus, Search, Folder, MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

type FilterStatus = 'all' | 'published' | 'draft';

export default function AutomationsPage() {
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [folders, setFolders] = useState<FolderType[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchData();
        checkConnection();
    }, []);

    async function checkConnection() {
        // We can check /api/meta/connection-status or just query supabase directly since it's client component
        // But for security/cleanliness let's use supabase client if available or just fetch.
        // Since we are in a rush and "Deploy Ready", let's query the table directly if we had the client,
        // or create a simple API.
        // Actually, we can just check if we have any connection in the list.
        try {
            // Assuming we have a way to check. Let's add a quick client-side check using supabase
            // We need to import createClient
            const { createClient } = await import('@/lib/supabase/client');
            const supabase = createClient();

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('ig_connections')
                    .select('access_token')
                    .eq('user_id', user.id)
                    .single();

                setIsConnected(!!data);
            }
        } catch (e) {
            console.error(e);
            setIsConnected(false);
        }
    }

    async function fetchData() {
        setLoading(true);
        try {
            const [autoRes, folderRes] = await Promise.all([
                fetch('/api/automations'),
                fetch('/api/folders')
            ]);

            if (autoRes.ok) {
                const data = await autoRes.json();
                setAutomations(data);
            }
            if (folderRes.ok) {
                const fData = await folderRes.json();
                setFolders(fData);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateFolder() {
        const name = prompt('Nome da nova pasta:');
        if (!name) return;

        try {
            const res = await fetch('/api/folders', {
                method: 'POST',
                body: JSON.stringify({ name }),
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                const newFolder = await res.json();
                setFolders(prev => [...prev, newFolder]);
            } else {
                alert('Erro ao criar pasta');
            }
        } catch (e) {
            console.error(e);
        }
    }

    function handleCreateAutomation() {
        router.push('/automations/create');
    }

    // Filter Logic
    const filteredAutomations = automations.filter(auto => {
        // Status Filter
        if (statusFilter === 'published' && auto.status !== 'published') return false;
        if (statusFilter === 'draft' && auto.status !== 'draft') return false;

        // Folder Filter
        if (selectedFolderId && auto.folder_id !== selectedFolderId) return false;
        // If Root is selected (null), logic could be "Show only with no folder" or "Show All".
        // Usually filtering by folder means "Inside this folder".
        // Let's assume: If a specific folder is clicked, show ONLY that folder's content.
        // If "Todos" (Root/All) is active, show everything? Or show Uncategorized?
        // Let's implement: "All" view shows everything. Clicking a folder filters by that folder.
        // But we need a way to see "Uncategorized".
        // Let's stick to: We display Folders as filtering chips.

        // Search
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            return auto.name.toLowerCase().includes(lower);
        }

        return true;
    });

    async function handleDeleteFolder(id: string, e: React.MouseEvent) {
        e.stopPropagation();
        if (!confirm('Tem certeza que deseja excluir esta pasta? As automações voltarão para a raiz.')) return;

        try {
            const res = await fetch(`/api/folders/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setFolders(prev => prev.filter(f => f.id !== id));
                if (selectedFolderId === id) setSelectedFolderId(null);
            } else {
                alert('Erro ao excluir pasta');
            }
        } catch (error) {
            console.error(error);
        }
    }

    // Determine current folder name or 'Todas'
    const currentFolderName = selectedFolderId
        ? folders.find(f => f.id === selectedFolderId)?.name || 'Pasta'
        : 'Todas';

    if (loading || isConnected === null) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!isConnected) {
        return (
            <div className="p-8 max-w-7xl mx-auto min-h-screen flex flex-col items-center justify-center text-center">
                <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl max-w-md w-full shadow-2xl">
                    <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Search className="w-8 h-8 text-brand-500" />
                        {/* Using Search as placeholder icon, or AlertTriangle if imported */}
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Conecte o Instagram</h2>
                    <p className="text-zinc-400 mb-8">
                        Para acessar suas automações, você precisa conectar uma conta do Instagram Business.
                    </p>
                    <button
                        onClick={() => router.push('/settings')}
                        className="w-full py-3 bg-brand-500 hover:bg-brand-400 text-zinc-950 font-bold rounded-xl transition-all"
                    >
                        Ir para Configurações
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Automações</h1>
                    <p className="text-muted-foreground mt-1">Gerencie seus fluxos de conversa e atendimento.</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleCreateFolder}
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

            {/* Folders List (Horizontal) */}
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
                            <button
                                onClick={(e) => handleDeleteFolder(folder.id, e)}
                                className="ml-1 p-0.5 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground opacity-0 group-hover:opacity-100 transition-all"
                                title="Excluir pasta"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters Row */}
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
                                ? 'bg-white dark:bg-zinc-700 text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
                                }`}
                        >
                            {status === 'all' ? 'Todos' : status === 'published' ? 'Publicados' : 'Rascunhos'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main List */}
            <div className="flex-1">
                {selectedFolderId && (
                    <div className="mb-4 text-sm text-muted-foreground flex items-center gap-2">
                        <span>Pasta: <span className="font-semibold text-foreground">{currentFolderName}</span></span>
                        <span className="w-1 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
                        <span>{filteredAutomations.length} automações</span>
                    </div>
                )}

                <AutomationList
                    automations={filteredAutomations}
                    loading={loading}
                    onCreateClick={handleCreateAutomation}
                />
            </div>
        </div>
    );
}
