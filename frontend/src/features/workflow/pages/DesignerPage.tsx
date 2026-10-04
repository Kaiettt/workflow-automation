import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNodesState, useEdgesState } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { workflowService } from '../services/workflow.service';
import { DesignerLayout } from '../components/DesignerLayout';
import { VersionHistoryDialog } from '../components/VersionHistoryDialog';
import { useDesignerStore } from '../store/designer.store';

interface DesignerPageProps {
  workflowId?: string;
  onBack?: () => void;
}

interface WorkflowDraft {
  definition?: {
    nodes?: Node[];
    edges?: Edge[];
  };
}

export function DesignerPage({ workflowId: propWorkflowId, onBack: propOnBack }: DesignerPageProps) {
  const { workflowId: paramWorkflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const workflowId = propWorkflowId || paramWorkflowId || '';
  const onBack = propOnBack || (() => navigate('/workflows'));

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);

  const isSaving = useDesignerStore((state) => state.isSaving);
  const setIsSaving = useDesignerStore((state) => state.setIsSaving);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const setNodeTypes = useDesignerStore((state) => state.setNodeTypes);

  // Load draft on mount
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [draft, nodeTypes] = await Promise.all([
          workflowService.getDraft(workflowId) as Promise<WorkflowDraft & { validationErrors?: { message: string } }>,
          workflowService.getNodeTypes(),
        ]);

        if (isMounted) {
          if (draft?.definition) {
            const rawNodes = (draft.definition.nodes || []) as Node[];
            const safeNodes = rawNodes.map((n, idx) => ({
              ...n,
              position: n.position || { x: 250, y: 100 + idx * 120 },
            }));
            setNodes(safeNodes);
            setEdges(draft.definition.edges || []);
          }
          if (draft?.validationErrors) {
            setPublishError(draft.validationErrors.message);
          }
          setNodeTypes(nodeTypes);
        }
      } catch (error) {
        console.error('Failed to load workflow data', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [workflowId, setNodes, setEdges, setNodeTypes]);

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
      if (
        window.confirm(
          'Xuất bản quy trình thành công! Bạn có muốn mở danh sách phiên bản để xem chi tiết và chạy thực thi (Run UI) không?',
        )
      ) {
        navigate(`/workflows/${workflowId}/versions`);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setPublishError(err.message);
      } else {
        setPublishError(String(err));
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRestoreSuccess = useCallback(
    (definition: { nodes?: Node[]; edges?: Edge[] } | unknown) => {
      const def = definition as { nodes?: Node[]; edges?: Edge[] };
      if (def?.nodes) {
        const safeNodes = def.nodes.map((n, idx) => ({
          ...n,
          position: n.position || { x: 250, y: 100 + idx * 120 },
        }));
        setNodes(safeNodes);
      }
      if (def?.edges) setEdges(def.edges);
      setPublishError(null);
    },
    [setNodes, setEdges],
  );

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
        onOpenHistory={() => setHistoryOpen(true)}
        onViewVersions={() => navigate(`/workflows/${workflowId}/versions`)}
      />
      <VersionHistoryDialog
        workflowId={workflowId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRestoreSuccess={handleRestoreSuccess}
      />
    </>
  );
}
