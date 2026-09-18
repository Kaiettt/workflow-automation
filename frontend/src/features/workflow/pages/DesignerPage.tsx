import { useEffect, useState, useCallback, useRef } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { workflowService } from '../services/workflow.service';
import { DesignerLayout } from '../components/DesignerLayout';
import { useDesignerStore } from '../store/designer.store';

interface DesignerPageProps {
  workflowId: string;
  onBack: () => void;
}

interface WorkflowDraft {
  definition?: {
    nodes?: Node[];
    edges?: Edge[];
  };
}

export function DesignerPage({ workflowId, onBack }: DesignerPageProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  
  const isSaving = useDesignerStore((state) => state.isSaving);
  const setIsSaving = useDesignerStore((state) => state.setIsSaving);
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Load draft on mount
  useEffect(() => {
    let isMounted = true;
    
    async function loadDraft() {
      try {
        const draft = (await workflowService.getDraft(workflowId)) as WorkflowDraft & { validationErrors?: { message: string } };
        if (isMounted) {
          if (draft?.definition) {
            setNodes(draft.definition.nodes || []);
            setEdges(draft.definition.edges || []);
          }
          if (draft?.validationErrors) {
            setPublishError(draft.validationErrors.message);
          }
        }
      } catch (error) {
        console.error('Failed to load workflow draft', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDraft();

    return () => {
      isMounted = false;
    };
  }, [workflowId, setNodes, setEdges]);

  // Auto-save logic (debounced)
  const saveDraft = useCallback(async (currentNodes: Node[], currentEdges: Edge[]) => {
    setIsSaving(true);
    // Clear validation error on edit
    setPublishError(null);
    try {
      const definition = {
        nodes: currentNodes,
        edges: currentEdges,
        viewport: { x: 0, y: 0, zoom: 1 } // Viewport could be synced with React Flow's onMove if needed
      };
      await workflowService.saveDraft(workflowId, definition);
    } catch (error) {
      console.error('Failed to save draft', error);
    } finally {
      setIsSaving(false);
    }
  }, [workflowId, setIsSaving]);

  useEffect(() => {
    if (loading) return; // Don't save during initial load
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDraft(nodes, edges);
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [nodes, edges, loading, saveDraft]);

  const handleNodeDataChange = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return { ...n, data };
        }
        return n;
      })
    );
  }, [setNodes]);

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishError(null);
    
    // Ensure latest changes are saved first
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    await saveDraft(nodes, edges);

    try {
      await workflowService.publishWorkflow(workflowId);
      alert('Workflow published successfully!'); // Simplistic toast
    } catch (err: any) {
      setPublishError(err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="text-xl font-semibold text-gray-600 animate-pulse">Loading designer...</div>
      </div>
    );
  }

  return (
    <>
      {publishError && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg w-96 flex justify-between items-center">
          <span className="block sm:inline">{publishError}</span>
          <button onClick={() => setPublishError(null)} className="ml-4 font-bold">&times;</button>
        </div>
      )}
      <DesignerLayout
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        setNodes={setNodes}
        setEdges={setEdges}
        onNodeDataChange={handleNodeDataChange}
        onBack={onBack}
        isSaving={isSaving}
        onPublish={handlePublish}
        isPublishing={isPublishing}
      />
    </>
  );
}
