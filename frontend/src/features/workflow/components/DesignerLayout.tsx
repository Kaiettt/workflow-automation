import { Sidebar } from './Sidebar';
import { PropertiesPanel } from './PropertiesPanel';
import { Canvas } from './Canvas';
import { useDesignerStore } from '../store/designer.store';
import { Button } from '@/components/ui/button';
import { History, ArrowLeft, GitBranch, AlertCircle } from 'lucide-react';
import type { Node, Edge, OnNodesChange, OnEdgesChange } from '@xyflow/react';

interface DesignerLayoutProps {
  workflowId: string;
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
  validationIssuesCount?: number;
  onOpenValidation?: () => void;
}

export function DesignerLayout({
  workflowId,
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
  validationIssuesCount,
  onOpenValidation,
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
            Back
          </Button>
          <div className="h-4 w-px bg-border" />
          <h1 className="font-semibold text-foreground text-base">Workflow Designer</h1>
        </div>
        <div className="flex items-center gap-3">
          {Boolean(validationIssuesCount) && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenValidation}
              className="gap-1.5 text-xs font-semibold text-rose-600 border-rose-300 bg-rose-50 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 animate-in fade-in"
            >
              <AlertCircle className="size-3.5 text-rose-500" />
              <span>Error</span>
              <span className="rounded-full bg-rose-200/80 px-1.5 py-0.2 text-[10px] text-rose-700">
                {validationIssuesCount}
              </span>
            </Button>
          )}

          {isSaving ? (
            <span className="text-xs text-muted-foreground italic">Saving...</span>
          ) : (
            <span className="text-xs text-emerald-600 font-medium">Draft saved</span>
          )}
          {onOpenHistory && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenHistory}
              className="gap-1.5 text-xs"
            >
              <History className="size-3.5" />
              Version History
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
              Versions (Run UI)
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={onPublish}
            disabled={isPublishing || isSaving}
            className="gap-1.5 text-xs font-medium"
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
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
          workflowId={workflowId}
          nodes={nodes}
          onNodeDataChange={onNodeDataChange}
          onDeleteNode={handleDeleteNode}
        />
      </main>
    </div>
  );
}
