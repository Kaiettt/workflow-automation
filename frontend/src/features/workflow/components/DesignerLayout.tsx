import { Sidebar } from './Sidebar';
import { PropertiesPanel } from './PropertiesPanel';
import { Canvas } from './Canvas';
import { useDesignerStore } from '../store/designer.store';
import { Button } from '@/components/ui/button';
import { History, ArrowLeft, GitBranch } from 'lucide-react';
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
  onPublish: () => void;
  isPublishing: boolean;
  onOpenHistory?: () => void;
  onViewVersions?: () => void;
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
  onPublish,
  isPublishing,
  onOpenHistory,
  onViewVersions,
}: DesignerLayoutProps) {
  const setSelectedNodeId = useDesignerStore((state) => state.setSelectedNodeId);

  // Removes the node together with the edges attached to it.
  const handleDeleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNodeId(null);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <header className="h-14 border-b border-gray-200 bg-white px-4 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground gap-1.5"
          >
            <ArrowLeft className="size-4" />
            Quay lại
          </Button>
          <div className="h-4 w-px bg-border" />
          <h1 className="font-semibold text-foreground text-base">Workflow Designer</h1>
        </div>
        <div className="flex items-center gap-3">
          {isSaving ? (
            <span className="text-xs text-muted-foreground italic">Đang lưu...</span>
          ) : (
            <span className="text-xs text-emerald-600 font-medium">Đã lưu nháp</span>
          )}
          {onOpenHistory && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenHistory}
              className="gap-1.5 text-xs"
            >
              <History className="size-3.5" />
              Lịch sử phiên bản
            </Button>
          )}
          {onViewVersions && (
            <Button
              variant="outline"
              size="sm"
              onClick={onViewVersions}
              className="gap-1.5 text-xs text-primary border-primary/20 hover:bg-primary/5"
            >
              <GitBranch className="size-3.5" />
              Phiên bản (Run UI)
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={onPublish}
            disabled={isPublishing || isSaving}
            className="gap-1.5 text-xs font-medium"
          >
            {isPublishing ? 'Đang xuất bản...' : 'Xuất bản'}
          </Button>
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
        <PropertiesPanel
          nodes={nodes}
          onNodeDataChange={onNodeDataChange}
          onDeleteNode={handleDeleteNode}
        />
      </main>
    </div>
  );
}
