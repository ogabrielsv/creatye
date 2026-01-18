import { DragEvent } from 'react';
import { NODE_REGISTRY } from '@/../creatye-core/automation/nodeRegistry';

export function NodeSidebar() {
    const onDragStart = (event: DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
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
        <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col h-full">
            <div className="p-4 border-b border-zinc-200">
                <h2 className="font-semibold text-zinc-900">Blocos</h2>
                <p className="text-xs text-zinc-500">Arraste para adicionar</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {(Object.keys(categories) as Array<keyof typeof categories>).map(catKey => (
                    groupedNodes[catKey] && (
                        <div key={catKey}>
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-1">
                                {categories[catKey]}
                            </h3>
                            <div className="space-y-2">
                                {groupedNodes[catKey].map((node: any) => {
                                    const Icon = node.icon;
                                    return (
                                        <div
                                            key={node.key}
                                            className="flex items-center gap-3 p-3 bg-white border border-zinc-200 rounded-lg cursor-grab hover:border-blue-400 hover:shadow-sm transition-all active:cursor-grabbing"
                                            draggable
                                            onDragStart={(event) => onDragStart(event, node.key)}
                                        >
                                            <div className="p-2 bg-zinc-50 rounded-md text-zinc-600">
                                                <Icon size={18} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-zinc-700">{node.label}</div>
                                                <div className="text-[10px] text-zinc-400 leading-tight">{node.description}</div>
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
