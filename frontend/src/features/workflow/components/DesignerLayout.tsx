import { Sidebar } from './Sidebar';
import { PropertiesPanel } from './PropertiesPanel';
import { Canvas } from './Canvas';
import type { Node, Edge, OnNodesChange, OnEdgesChange } from '@xyflow/react';

interface DesignerLayoutProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onNodeDataChange: (nodeId: string, data: Record<string, unknown>) => void;
  onBack: () => void;
  isSaving: boolean;
}

export function DesignerLayout({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  setNodes,
  setEdges,
  onNodeDataChange,
  onBack,
  isSaving,
}: DesignerLayoutProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <header className="h-14 border-b border-gray-200 bg-white px-4 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="text-gray-500 hover:text-gray-800 transition-colors"
          >
            ← Back
          </button>
          <h1 className="font-bold text-gray-800 text-lg">Workflow Designer</h1>
        </div>
        <div className="flex items-center gap-2">
          {isSaving ? (
            <span className="text-sm text-gray-400 italic">Saving...</span>
          ) : (
            <span className="text-sm text-green-600">Saved</span>
          )}
        </div>
      </header>
      
      <main className="flex-1 flex overflow-hidden relative">
        <Sidebar />
        <Canvas 
          nodes={nodes} 
          edges={edges} 
          onNodesChange={onNodesChange} 
          onEdgesChange={onEdgesChange} 
          setNodes={setNodes} 
          setEdges={setEdges} 
        />
        <PropertiesPanel nodes={nodes} onNodeDataChange={onNodeDataChange} />
      </main>
    </div>
  );
}
