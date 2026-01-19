
import { MessageCircle, Send, GitFork } from 'lucide-react';

import { NODE_REGISTRY } from '@/lib/automations/nodeRegistry';

export default function BuilderSidebar() {
    const onDragStart = (event: React.DragEvent, nodeType: string, defaultData: any) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        // Default data structure usually empty or specific per node
        const data = defaultData || {};
        event.dataTransfer.setData('application/reactflow-data', JSON.stringify(data));
        event.dataTransfer.effectAllowed = 'move';
    };

    const categories = {
        base: 'Base',
        action: 'Ações',
        logic: 'Lógica'
    };

    // Group nodes
    const groupedNodes = Object.entries(NODE_REGISTRY).reduce((acc: any, [key, def]) => {
        const cat = def.category;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push({ ...def, key });
        return acc;
    }, {});

    return (
        <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col h-full z-20 shadow-sm">
            <div className="p-4 border-b border-zinc-100">
                <h2 className="font-semibold text-zinc-900 text-sm">Blocos (Completo)</h2>
                <p className="text-xs text-zinc-500">Arraste para adicionar</p>
            </div>

            <div className="p-4 space-y-6 overflow-y-auto flex-1">
                {/* Trigger Special Block (Always available, confusing if not in registry?) 
                     Lets keep the Trigger separate or add to registry. 
                     Registry has 'message', 'buttons', etc. 
                     TriggerNode is special 'root' usually. But for DragDrop it's useful.
                     Let's add a manual Trigger Block if not in registry.
                 */}
                <div>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 px-1">Gatilhos</h3>
                    <div
                        className="p-3 bg-white border border-blue-200 rounded-lg cursor-grab hover:shadow-md transition-all flex items-center gap-3 select-none"
                        onDragStart={(event) => onDragStart(event, 'triggerNode', { keyword: '', matchType: 'contains' })}
                        draggable
                    >
                        <div className="p-2 bg-blue-50 text-blue-600 rounded">
                            {/* Lucide Icon manually */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" /></svg>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-zinc-900">Gatilho</div>
                            <div className="text-[10px] text-zinc-500">DM ou Comentário</div>
                        </div>
                    </div>
                </div>

                {(Object.keys(categories) as Array<keyof typeof categories>).map(catKey => (
                    groupedNodes[catKey] && (
                        <div key={catKey}>
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 px-1">
                                {categories[catKey]}
                            </h3>
                            <div className="space-y-2">
                                {groupedNodes[catKey].map((node: any) => {
                                    const Icon = node.icon;
                                    return (
                                        <div
                                            key={node.key}
                                            className="p-3 bg-white border border-zinc-200 rounded-lg cursor-grab hover:shadow-md hover:border-brand-200 transition-all flex items-center gap-3 select-none"
                                            draggable
                                            onDragStart={(event) => onDragStart(event, node.type, {})}
                                        >
                                            <div className="p-2 bg-zinc-50 text-zinc-600 rounded">
                                                <Icon size={16} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-zinc-900">{node.label}</div>
                                                <div className="text-[10px] text-zinc-500">{node.description}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )
                ))}
            </div>
        </aside>
    );
}
