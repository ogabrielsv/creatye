'use client';

import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useParams, useRouter } from 'next/navigation';
import debounce from 'lodash.debounce';

import { nodeTypes } from '@/components/editor/nodes';
import { NodeSidebar } from '@/components/editor/NodeSidebar';
import { NodeInspector } from '@/components/editor/NodeInspector';
import { ArrowLeft, Play, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function EditorPage() {
    const { id } = useParams();
    const router = useRouter();

    // Flow State
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Automation State
    const [loading, setLoading] = useState(true);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [saving, setSaving] = useState(false);

    // Trigger State
    const [keywords, setKeywords] = useState<string[]>([]);
    const [keywordInput, setKeywordInput] = useState('');

    useEffect(() => {
        fetchDraft();
    }, [id]);

    const fetchDraft = async () => {
        try {
            const res = await fetch(`/api/automations/${id}/draft`);
            const data = await res.json();

            if (data.nodes && data.nodes.length > 0) {
                setNodes(data.nodes);
                setEdges(data.edges || []);
            } else {
                setNodes([{
                    id: 'start-1',
                    type: 'start',
                    position: { x: 100, y: 100 },
                    data: { label: 'Início' }
                }]);
            }

            // Set Triggers
            if (data.triggers && data.triggers.length > 0) {
                // Find the keywords trigger
                const kwTrigger = data.triggers.find((t: any) => t.type === 'contains_keywords');
                if (kwTrigger && kwTrigger.payload?.keywords) {
                    setKeywords(kwTrigger.payload.keywords);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setLastSaved(new Date());
        }
    };

    // Auto-Save
    const saveDraft = async (currentNodes: any[], currentEdges: any[], currentKeywords: string[]) => {
        setSaving(true);
        try {
            const triggers = currentKeywords.length > 0
                ? [{ type: 'contains_keywords', payload: { keywords: currentKeywords, match: 'any' } }]
                : [];

            await fetch(`/api/automations/${id}/draft`, {
                method: 'POST',
                body: JSON.stringify({
                    nodes: currentNodes,
                    edges: currentEdges,
                    triggers
                }),
                headers: { 'Content-Type': 'application/json' }
            });
            setLastSaved(new Date());
        } catch (e) {
            console.error('Save failed', e);
        } finally {
            setSaving(false);
        }
    };

    // Debounce the save function including keywords
    const debouncedSave = useCallback(debounce((n, e, k) => saveDraft(n, e, k), 2000), [id]);

    useEffect(() => {
        if (!loading) {
            debouncedSave(nodes, edges, keywords);
        }
    }, [nodes, edges, keywords, debouncedSave, loading]);

    // Flow Events
    const onConnect = useCallback((params: Connection | Edge) => {
        setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true }, eds));
    }, [setEdges]);

    const onDragOver = useCallback((event: any) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: any) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            if (typeof type === 'undefined' || !type) return;

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode = {
                id: uuidv4(),
                type,
                position,
                data: { label: `${type} node` },
            };

            setNodes((nds) => nds.concat(newNode));
            setSelectedNodeId(newNode.id);
        },
        [reactFlowInstance, setNodes]
    );

    const onNodeClick = (_: any, node: any) => {
        setSelectedNodeId(node.id);
    };

    const updateNodeData = (nodeId: string, newData: any) => {
        setNodes((nds) =>
            nds.map((node) => (node.id === nodeId ? { ...node, data: newData } : node))
        );
    };

    const handlePublish = async () => {
        if (!nodes.some(n => n.type === 'start')) {
            alert('Erro: O fluxo precisa de um nó Início.');
            return;
        }

        // Ensure latest state saves before publish? 
        // Or publish uses draft table directly. My API code uses draft table.
        // So we should wait for auto-save or force save.
        await saveDraft(nodes, edges, keywords);

        const res = await fetch(`/api/automations/${id}/publish`, { method: 'POST' });
        if (res.ok) {
            alert('Automação publicada com sucesso!');
        } else {
            const err = await res.json();
            alert(`Erro: ${err.error}`);
        }
    };

    // Trigger Chips Logic
    const addKeyword = () => {
        if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
            setKeywords([...keywords, keywordInput.trim()]);
            setKeywordInput('');
        }
    };

    const removeKeyword = (kw: string) => {
        setKeywords(keywords.filter(k => k !== kw));
    };

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    if (loading) return <div className="p-8">Carregando editor...</div>;

    return (
        <div className="flex flex-col h-screen bg-white">
            {/* Header */}
            <div className="h-16 border-b border-zinc-200 flex items-center justify-between px-4 bg-white z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="font-semibold text-zinc-900">Editor de Fluxo</h1>
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                            {saving ? 'Safando...' : lastSaved ? `Salvo em ${lastSaved.toLocaleTimeString()}` : 'Rascunho'}
                        </p>
                    </div>
                </div>

                {/* Trigger Bar (Compact) */}
                <div className="flex-1 max-w-2xl mx-8 hidden md:flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 overflow-hidden">
                    <span className="text-xs font-bold text-zinc-500 uppercase whitespace-nowrap">Quando conter:</span>
                    <div className="flex flex-wrap gap-1 items-center flex-1">
                        {keywords.map(kw => (
                            <span key={kw} className="bg-white border border-zinc-200 text-xs px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                {kw}
                                <button onClick={() => removeKeyword(kw)} className="text-zinc-400 hover:text-red-500"><X size={10} /></button>
                            </span>
                        ))}
                        <input
                            type="text"
                            value={keywordInput}
                            onChange={(e) => setKeywordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                            placeholder="Digite keyword + Enter..."
                            className="bg-transparent text-xs focus:outline-none min-w-[120px]"
                        />
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={handlePublish} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
                        <Play size={16} />
                        Publicar
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex overflow-hidden">
                <NodeSidebar />

                <div className="flex-1 relative bg-zinc-50" style={{ height: 'calc(100vh - 64px)' }}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onInit={setReactFlowInstance}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onNodeClick={onNodeClick}
                        nodeTypes={nodeTypes}
                        fitView
                        attributionPosition="bottom-left"
                    >
                        <Background color="#ccc" gap={20} />
                        <Controls />
                        <MiniMap style={{ height: 120 }} zoomable pannable />
                    </ReactFlow>
                </div>

                {selectedNode && (
                    <NodeInspector
                        selectedNode={selectedNode}
                        updateNodeData={updateNodeData}
                        onClose={() => setSelectedNodeId(null)}
                    />
                )}
            </div>
        </div>
    );
}
