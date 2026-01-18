'use client';

import {
    useState,
    useCallback,
    useRef,
    useEffect,
    DragEvent
} from 'react';
import ReactFlow, {
    Node,
    Edge,
    addEdge,
    Connection,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    ReactFlowProvider,
    useReactFlow,
    Panel,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

import StartNode from './blocks/StartNode';
import MessageNode from './blocks/MessageNode';
import ButtonsNode from './blocks/ButtonsNode';
import AddTagNode from './blocks/AddTagNode';
import RemoveTagNode from './blocks/RemoveTagNode';
import WaitNode from './blocks/WaitNode';
import ConditionNode from './blocks/ConditionNode';

import NodePanel from './NodePanel';
import PropertiesPanel from './PropertiesPanel';
import { createClient } from '@/lib/supabase/client';
import debounce from 'lodash.debounce';
import { Check, Cloud } from 'lucide-react';
import { toast } from 'sonner';

const nodeTypes = {
    start: StartNode,
    message: MessageNode,
    buttons: ButtonsNode,
    add_tag: AddTagNode,
    remove_tag: RemoveTagNode,
    wait: WaitNode,
    condition: ConditionNode,
};

// Autosave hook helper
function useAutosave(automationId: string, nodes: Node[], edges: Edge[]) {
    const supabase = createClient();
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    const saveDraft = useCallback(async (currentNodes: Node[], currentEdges: Edge[]) => {
        setSaving(true);
        console.log("Saving draft...");

        const { error } = await supabase
            .from('automation_drafts')
            .upsert({
                automation_id: automationId,
                nodes: currentNodes,
                edges: currentEdges,
                updated_at: new Date().toISOString()
            }, { onConflict: 'automation_id' });

        if (error) {
            console.error('Error saving draft:', error);
        } else {
            setLastSaved(new Date());
        }
        setSaving(false);
    }, [automationId, supabase]);

    // Debounced save
    const debouncedSave = useRef(
        debounce((n: Node[], e: Edge[]) => saveDraft(n, e), 1000)
    ).current;

    useEffect(() => {
        if (nodes.length > 0) { // Don't save empty init state if it's loading
            debouncedSave(nodes, edges);
        }
    }, [nodes, edges, debouncedSave]);

    return { saving, lastSaved };
}

export default function FlowEditor({ automationId }: { automationId: string }) {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const { project } = useReactFlow();
    const supabase = createClient();

    // Load Initial Data
    useEffect(() => {
        const loadData = async () => {
            // Try to load draft first
            const { data: draft, error } = await supabase
                .from('automation_drafts')
                .select('nodes, edges')
                .eq('automation_id', automationId)
                .single();

            if (draft && draft.nodes) {
                setNodes(draft.nodes);
                setEdges(draft.edges || []);
            } else {
                // Load published version or init
                // For now, init with Start Node if nothing
                setNodes([
                    {
                        id: 'start-node',
                        type: 'start',
                        position: { x: 250, y: 100 },
                        data: { label: 'Início' },
                        deletable: false,
                    }
                ]);
            }
        };
        loadData();
    }, [automationId, supabase, setNodes, setEdges]);

    // Hook for autosave
    const { saving, lastSaved } = useAutosave(automationId, nodes, edges);

    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({
        ...params,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed }
    }, eds)), [setEdges]);

    const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = reactFlowWrapper.current?.getBoundingClientRect();
            // project was renamed to screenToFlowPosition in ReactFlow 12?? 
            // Checking version: user package.json says reactflow ^11.10.0. 
            // In v11: project. In v12: screenToFlowPosition.
            // Let's assume project for v11 compatibility.
            const projected = project({
                x: event.clientX - (position?.left || 0),
                y: event.clientY - (position?.top || 0),
            });

            const newNode: Node = {
                id: crypto.randomUUID(),
                type,
                position: projected,
                data: { label: `${type} node` }, // Defaults
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [project, setNodes]
    );

    const onNodeClick = (_: any, node: Node) => {
        setSelectedNode(node);
    };

    const onPaneClick = () => {
        setSelectedNode(null);
    };

    const updateNodeData = (id: string, newData: any) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === id) {
                    node.data = { ...node.data, ...newData };
                    // If selected, update it too to reflect in panel
                    if (selectedNode?.id === id) {
                        setSelectedNode({ ...node });
                    }
                }
                return node;
            })
        );
    };

    const deleteNode = (id: string) => {
        setNodes((nds) => nds.filter(n => n.id !== id));
        setSelectedNode(null);
    };

    const publish = async () => {
        const confirm = window.confirm("Deseja publicar esta versão? Isso afetará os contatos em tempo real.");
        if (!confirm) return;

        // Logic: Insert into versions, update automations status
        // Get max version
        // This logic should ideally be server-side for transactional integrity, 
        // but simpler for MVP to call an API endpoint.

        try {
            const res = await fetch(`/api/automations/${automationId}/publish`, { method: 'POST' });
            if (res.ok) {
                toast.success("Publicado com sucesso!");
            } else {
                toast.error("Erro ao publicar.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Erro de conexão.");
        }
    };

    return (
        <div className="flex h-full">
            <NodePanel />

            <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
                <div className="absolute top-4 left-4 z-10 flex gap-4">
                    {/* Status Badge */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full px-4 py-1.5 text-xs font-medium flex items-center gap-2 shadow-sm">
                        {saving ? (
                            <>
                                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Cloud className="w-4 h-4 text-green-500" />
                                <span className="text-zinc-600 dark:text-zinc-400">
                                    Salvo {lastSaved ? `às ${lastSaved.toLocaleTimeString()}` : ''}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <div className="absolute top-4 right-4 z-10">
                    <button
                        onClick={publish}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
                    >
                        <Check className="w-4 h-4" />
                        Publicar Alterações
                    </button>
                </div>

                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    fitView
                >
                    <Background gap={12} size={1} />
                    <Controls />
                </ReactFlow>
            </div>

            {selectedNode && (
                <PropertiesPanel
                    selectedNode={selectedNode}
                    onClose={() => setSelectedNode(null)}
                    onUpdate={updateNodeData}
                    onDelete={deleteNode}
                />
            )}
        </div>
    );
}
