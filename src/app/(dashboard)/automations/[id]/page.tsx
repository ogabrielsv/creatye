
'use client';

import { useEffect, useState, useCallback } from 'react';
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
    ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Play, Save, ArrowLeft, Settings, Loader2 } from 'lucide-react';

// Custom Nodes (placeholder for now, will implement actual components later)
// import StartNode from '@/components/automations/nodes/StartNode';
// import MessageNode from '@/components/automations/nodes/MessageNode';

const nodeTypes = {
    // start: StartNode,
    // message: MessageNode,
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

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');

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
            setName(data.name);

            // Load Draft or fallback to initial
            // Ideally check automation_drafts table via API
            // For now, let's assume the API returns the draft state if query param 'draft=true' 
            // OR we fetch drafts separately.
            // Let's simplified: The creation endpoint created a draft.
            // We should fetch that draft.

            // Temporary fetch from new endpoint or reuse? 
            // Let's implement /api/automations/[id]/draft route later. 
            // For now, load default if empty.

            if (data.nodes) {
                setNodes(data.nodes || []);
                setEdges(data.edges || []);
            } else {
                // Initialize default
                setNodes([
                    {
                        id: 'start-1',
                        type: 'input', // default
                        data: { label: 'Início' },
                        position: { x: 250, y: 5 }
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
        (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
        [setEdges]
    );

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/automations/${id}/draft`, {
                method: 'POST', // or PUT
                body: JSON.stringify({ nodes, edges }),
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) throw new Error('Failed to save');

            // alert('Salvo com sucesso!'); 
        } catch (e) {
            console.error(e);
            alert('Erro ao salvar.');
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
            <div className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-4 z-10">
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
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-700 font-medium rounded-lg hover:bg-zinc-50 text-sm transition-all"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Salvar
                    </button>
                    <button
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-sm transition-all shadow-sm shadow-blue-600/20"
                    >
                        <Play size={16} fill="currentColor" />
                        Publicar
                    </button>
                </div>
            </div>

            {/* Editor */}
            <div className="flex-1 w-full h-full">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    fitView
                    nodeTypes={nodeTypes}
                >
                    <Background color="#ccc" gap={16} />
                    <Controls />
                </ReactFlow>
            </div>
        </div>
    );
}
