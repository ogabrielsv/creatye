import { Handle, Position, NodeProps } from 'reactflow';
import { ButtonsNodeData } from '@/lib/schemas/nodes';

export default function ButtonsNode({ data }: NodeProps<ButtonsNodeData>) {
    return (
        <div className="min-w-[250px] bg-white dark:bg-zinc-900 border-l-4 border-purple-500 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-purple-500" />

            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-purple-500">Botões</span>
            </div>

            <div className="p-4 space-y-3">
                <div className="text-sm text-zinc-600 dark:text-zinc-300">
                    {data.message || "Digite sua mensagem..."}
                </div>

                <div className="flex flex-col gap-2">
                    {data.buttons?.map((btn, index) => (
                        <div key={index} className="bg-zinc-100 dark:bg-zinc-800 text-center py-2 rounded text-sm text-blue-600 font-medium border border-zinc-200 dark:border-zinc-700 relative">
                            {btn.label || "Botão"}
                            {/* If type is 'next', we could put a handle here for specific path.
                        But standard flow often uses single output for simple buttons or specific handles.
                        Gaio uses handles per button often if it branches. 
                        Let's assume universal output for now OR per-button handles. 
                        The schema has 'type: link | next'. 
                        If 'next', it should probably have a source handle.
                    */}
                            {btn.type === 'next' && (
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id={`btn-${index}`}
                                    className="w-2 h-2 bg-purple-500 !-right-3"
                                />
                            )}
                        </div>
                    ))}
                    {(!data.buttons || data.buttons.length === 0) && (
                        <div className="text-xs text-zinc-400 italic text-center">Nenhum botão configurado</div>
                    )}
                </div>
            </div>
            {/* Fallback source usually not needed if buttons drive flow, but good to have one general if needed? 
           Usually buttons node splits flow. So handles refer to buttons properly.
       */}
        </div>
    );
}
