import {
    MessageSquare,
    MousePointerClick,
    Tag,
    Clock,
    Split,
    Trash
} from 'lucide-react';
import { DragEvent } from 'react';

export default function NodePanel() {
    const onDragStart = (event: DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col h-full z-10">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">Biblioteca</h2>
                <p className="text-xs text-zinc-500">Arraste os blocos para o fluxo</p>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1">

                <div
                    className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-grab hover:shadow-md transition-shadow"
                    onDragStart={(event) => onDragStart(event, 'message')}
                    draggable
                >
                    <MessageSquare className="w-5 h-5 text-blue-500" />
                    <div className="text-sm font-medium">Mensagem</div>
                </div>

                <div
                    className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-grab hover:shadow-md transition-shadow"
                    onDragStart={(event) => onDragStart(event, 'buttons')}
                    draggable
                >
                    <MousePointerClick className="w-5 h-5 text-purple-500" />
                    <div className="text-sm font-medium">Botões</div>
                </div>

                {/* <div 
            className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-grab hover:shadow-md transition-shadow"
            onDragStart={(event) => onDragStart(event, 'cards')}
            draggable
        >
            <Layout className="w-5 h-5 text-indigo-500" />
            <div className="text-sm font-medium">Cartões</div>
        </div> */}

                <div className="my-2 border-t border-zinc-100 dark:border-zinc-800"></div>
                <p className="text-xs font-bold text-zinc-400 uppercase mb-2">Lógica</p>

                <div
                    className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-grab hover:shadow-md transition-shadow"
                    onDragStart={(event) => onDragStart(event, 'condition')}
                    draggable
                >
                    <Split className="w-5 h-5 text-yellow-500" />
                    <div className="text-sm font-medium">Condição</div>
                </div>

                <div
                    className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-grab hover:shadow-md transition-shadow"
                    onDragStart={(event) => onDragStart(event, 'wait')}
                    draggable
                >
                    <Clock className="w-5 h-5 text-zinc-500" />
                    <div className="text-sm font-medium">Aguardar</div>
                </div>

                <div className="my-2 border-t border-zinc-100 dark:border-zinc-800"></div>
                <p className="text-xs font-bold text-zinc-400 uppercase mb-2">Ações</p>

                <div
                    className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-grab hover:shadow-md transition-shadow"
                    onDragStart={(event) => onDragStart(event, 'add_tag')}
                    draggable
                >
                    <Tag className="w-5 h-5 text-orange-500" />
                    <div className="text-sm font-medium">Add Tag</div>
                </div>

                <div
                    className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-grab hover:shadow-md transition-shadow"
                    onDragStart={(event) => onDragStart(event, 'remove_tag')}
                    draggable
                >
                    <Trash className="w-5 h-5 text-gray-500" />
                    <div className="text-sm font-medium">Remover Tag</div>
                </div>

            </div>
        </aside>
    );
}
