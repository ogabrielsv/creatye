import { Automation } from '@/../creatye-core/automation/types';
import Link from 'next/link';
import { Play, Pause, MoreVertical, Edit, Trash2, Box, MessageCircle, Instagram } from 'lucide-react';

interface AutomationCardProps {
    automation: Automation;
    onDelete?: (id: string) => void;
}

export function AutomationCard({ automation, onDelete }: AutomationCardProps) {
    const statusColor = automation.status === 'published'
        ? 'bg-green-100 text-green-700 border-green-200'
        : 'bg-zinc-100 text-zinc-600 border-zinc-200';

    const TypeIcon = automation.type === 'story' ? Instagram : MessageCircle;

    return (
        <div className="group relative bg-white border border-zinc-200 rounded-xl p-5 hover:shadow-md transition-all hover:border-blue-200">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Box size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-zinc-900 group-hover:text-blue-600 transition-colors">
                            {automation.name}
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                            {new Date(automation.updated_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <button className="p-1 hover:bg-zinc-100 rounded text-zinc-400">
                    <MoreVertical size={16} />
                </button>
            </div>

            <div className="flex items-center gap-4 text-sm text-zinc-500 mb-6">
                <div className="flex items-center gap-1.5">
                    <Play size={14} />
                    <span className="font-medium text-zinc-700">{automation.executions}</span>
                    <span className="text-xs">execuções</span>
                </div>

                <div className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor} capitalize`}>
                    {automation.status}
                </div>
            </div>

            <div className="flex items-center gap-2 mt-auto">
                <Link
                    href={`/automations/${automation.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-medium rounded-lg text-sm border border-zinc-100 transition-colors"
                >
                    <Edit size={14} />
                    Editar Fluxo
                </Link>
            </div>
        </div>
    );
}
