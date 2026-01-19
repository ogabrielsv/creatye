
import { MessageCircle, Send, GitFork } from 'lucide-react';

export default function BuilderSidebar() {
    const onDragStart = (event: React.DragEvent, nodeType: string, defaultData: any) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.setData('application/reactflow-data', JSON.stringify(defaultData));
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col h-full z-20 shadow-sm">
            <div className="p-4 border-b border-zinc-100">
                <h2 className="font-semibold text-zinc-900 text-sm">Blocos</h2>
                <p className="text-xs text-zinc-500">Arraste para adicionar</p>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1">

                <div
                    className="p-3 bg-white border border-blue-200 rounded-lg cursor-grab hover:shadow-md transition-all flex items-center gap-3 select-none"
                    onDragStart={(event) => onDragStart(event, 'triggerNode', { keyword: '', matchType: 'contains' })}
                    draggable
                >
                    <div className="p-2 bg-blue-50 text-blue-600 rounded">
                        <MessageCircle size={16} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-zinc-900">Gatilho (DM)</div>
                        <div className="text-[10px] text-zinc-500">Mensagem recebida</div>
                    </div>
                </div>

                <div
                    className="p-3 bg-white border border-purple-200 rounded-lg cursor-grab hover:shadow-md transition-all flex items-center gap-3 select-none"
                    onDragStart={(event) => onDragStart(event, 'conditionNode', { condition: 'Texto contém' })}
                    draggable
                >
                    <div className="p-2 bg-purple-50 text-purple-600 rounded">
                        <GitFork size={16} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-zinc-900">Condição</div>
                        <div className="text-[10px] text-zinc-500">Verificar lógica</div>
                    </div>
                </div>

                <div
                    className="p-3 bg-white border border-orange-200 rounded-lg cursor-grab hover:shadow-md transition-all flex items-center gap-3 select-none"
                    onDragStart={(event) => onDragStart(event, 'actionNode', { message: '' })}
                    draggable
                >
                    <div className="p-2 bg-orange-50 text-orange-600 rounded">
                        <Send size={16} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-zinc-900">Ação</div>
                        <div className="text-[10px] text-zinc-500">Responder DM</div>
                    </div>
                </div>

            </div>
        </aside>
    );
}
