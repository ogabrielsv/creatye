'use client';

import { Automation } from '@/types/automation';
import { AutomationCard } from './AutomationCard';
import { Plus } from 'lucide-react';

interface AutomationListProps {
    automations: Automation[];
    loading?: boolean;
    onCreateClick?: () => void;
    onDelete?: (id: string) => void;
}

export function AutomationList({ automations, loading, onCreateClick, onDelete }: AutomationListProps) {
    if (loading) {
        return <div className="p-8 text-center text-zinc-500">Carregando automações...</div>;
    }

    if (automations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-xl bg-secondary/30">
                <div className="p-4 bg-brand-50/50 dark:bg-brand-950/30 rounded-full mb-4">
                    <Plus className="w-8 h-8 text-brand-500" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">Crie sua primeira automação</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-sm text-center">
                    Comece a automatizar suas conversas no Instagram e aumente suas vendas.
                </p>
                <button
                    onClick={onCreateClick}
                    className="bg-brand-500 hover:bg-brand-400 text-zinc-950 px-5 py-2.5 rounded-lg font-bold transition-all shadow-lg shadow-brand-500/20"
                >
                    Criar Automação
                </button>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
            {automations.map(auto => (
                <AutomationCard key={auto.id} automation={auto} onDelete={onDelete} />
            ))}
        </div>
    );
}
