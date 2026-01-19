
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactFlow, {
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    MarkerType,
    ReactFlowProvider,
    useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Play, Save, ArrowLeft, Settings, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Legacy Nodes
import StartNode from '@/components/automations/nodes/StartNode';
import TriggerNode from '@/components/automations/nodes/TriggerNode';
import ActionNode from '@/components/automations/nodes/ActionNode';
import ConditionNode from '@/components/automations/nodes/ConditionNode';

// New Nodes
import { nodeTypes as editorNodeTypes } from '@/components/editor/nodes';
import PropertiesPanel from '@/components/editor/PropertiesPanel';
import BuilderSidebar from '@/components/automations/BuilderSidebar';

// Merge Types
const nodeTypes = {
    ...editorNodeTypes, // message, buttons, cards, wait, condition_tag, etc.
    start: StartNode,    // Keep legacy Start for now or use editorNodeTypes.start? Let's use legacy StartNode as it was visually matched.
    triggerNode: TriggerNode,
    actionNode: ActionNode,     // Legacy generic action
    conditionNode: ConditionNode // Legacy generic condition
};

export default function AutomationBuilderPage() {
    return (
        <ReactFlowProvider>
            <AutomationBuilder />
        </ReactFlowProvider>
    );
}

function AutomationBuilder() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { project } = useReactFlow();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');

    // Selection for Config
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    // React Flow State
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        fetchAutomation();
    }, [id]);

    async function fetchAutomation() {
        try {
            const res = await fetch(`/api/automations/${id}`);
            if (!res.ok) {
                if (res.status === 404) {
                    alert('Automação não encontrada');
                    router.push('/automations');
                    return;
                }
                throw new Error('Failed to load');
            }
            const data = await res.json();
            const automationData = data;

            setName(automationData.title || automationData.name);

            if (automationData.nodes && automationData.nodes.length > 0) {
                setNodes(automationData.nodes);
                setEdges(automationData.edges || []);
            } else {
                setNodes([
                    {
                        id: 'start-1',
                        type: 'start',
                        data: { label: 'Início' },
                        position: { x: 250, y: 50 },
                        deletable: false
                    }
                ]);
            }
        } catch (e) {
            console.error(e);
            alert('Erro ao carregar automação');
        } finally {
            setLoading(false);
        }
    }

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({
            ...params,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2 }
        }, eds)),
        [setEdges]
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            const dataString = event.dataTransfer.getData('application/reactflow-data');

            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = project({
                x: event.clientX - (reactFlowWrapper.current?.getBoundingClientRect().left || 0),
                y: event.clientY - (reactFlowWrapper.current?.getBoundingClientRect().top || 0),
            });

            const newNode: Node = {
                id: uuidv4(),
                type,
                position,
                data: JSON.parse(dataString || '{}'),
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [project, setNodes]
    );

    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        if (node.type === 'start') return;
        setSelectedNode(node);
    }, []);

    const updateNodeData = (nodeId: string, newData: any) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    node.data = { ...node.data, ...newData };
                    if (selectedNode?.id === nodeId) {
                        setSelectedNode({ ...node });
                    }
                }
                return node;
            })
        );
    };

    const handleDeleteNode = (nodeId: string) => {
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
        setSelectedNode(null);
    };

    const handleSave = async (status: 'draft' | 'published' = 'draft') => {
        setSaving(true);
        try {
            const payload = {
                nodes,
                edges,
                status,
                // Also update trigger keyword if triggerNode exists
                trigger: nodes.find(n => n.type === 'triggerNode')?.data?.keyword || undefined,
                trigger_type: nodes.find(n => n.type === 'triggerNode')?.data?.triggerType || 'dm_keyword'
            };

            const res = await fetch(`/api/automations/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' }
            });

            // Capture JSON regardless of status to show error details
            const json = await res.json().catch(() => ({}));

            if (!res.ok) {
                const errorMsg = json.details || json.error || 'Erro desconhecido';
                const step = json.step ? ` [${json.step}]` : '';
                throw new Error(`${errorMsg}${step}`);
            }

            if (status === 'published') {
                alert('Automação Publicada com Sucesso!');
            } else {
                // Optional: distinct message for draft
                // alert('Rascunho salvo!'); 
            }

        } catch (e: any) {
            console.error(e);
            alert(`Erro ao salvar: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="h-screen flex items-center justify-center bg-zinc-50"><Loader2 className="animate-spin text-zinc-400" /></div>;
    }

    return (
        <div className="h-screen flex flex-col bg-zinc-50">
            {/* Header */}
            <div className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-4 z-30 relative shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push('/automations')} className="text-zinc-500 hover:text-zinc-900">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-bold text-zinc-900">{name}</h1>
                        <span className="text-xs text-zinc-500">Fluxo de conversa</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleSave('draft')}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-700 font-medium rounded-lg hover:bg-zinc-50 text-sm transition-all"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Salvar
                    </button>
                    <button
                        onClick={() => handleSave('published')}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-sm transition-all shadow-sm shadow-blue-600/20"
                    >
                        <Play size={16} fill="currentColor" />
                        Publicar
                    </button>
                </div>
            </div>

            {/* Editor Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <BuilderSidebar />

                {/* Canvas */}
                <div className="flex-1 relative h-full bg-zinc-50/50" ref={reactFlowWrapper}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        onNodeClick={onNodeClick}
                        onPaneClick={() => setSelectedNode(null)}
                        fitView
                        nodeTypes={nodeTypes}
                    >
                        <Background color="#ccc" gap={20} size={1} />
                        <Controls />
                    </ReactFlow>

                    {/* Config Panel */}
                    {selectedNode && (
                        <PropertiesPanel
                            selectedNode={selectedNode}
                            onClose={() => setSelectedNode(null)}
                            onUpdate={updateNodeData}
                            onDelete={handleDeleteNode}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
