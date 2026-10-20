import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNodesState, useEdgesState } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { workflowService } from '../services/workflow.service';
import { DesignerLayout } from '../components/DesignerLayout';
import { VersionHistoryDialog } from '../components/VersionHistoryDialog';
import { useDesignerStore } from '../store/designer.store';
import { PublishValidationAlert } from '../components/PublishValidationAlert';
import {
  WorkflowPublishValidationError,
  type WorkflowValidationIssue,
} from '../models/workflow-validation.model';

interface DesignerPageProps {
  workflowId?: string;
  onBack?: () => void;
}

interface WorkflowDraft {
  definition?: {
    nodes?: Node[];
    edges?: Edge[];
  };
  validationErrors?: {
    message?: string;
    issues?: WorkflowValidationIssue[];
  } | null;
}

const VALIDATION_NODE_CLASS = 'workflow-validation-error';

function updateValidationHighlights(
  nodes: Node[],
  issues: WorkflowValidationIssue[],
): Node[] {
  const invalidNodeIds = new Set(
    issues.flatMap((issue) => (issue.nodeId ? [issue.nodeId] : [])),
  );
  let changed = false;

  const updatedNodes = nodes.map((node) => {
    const classNames = (node.className ?? '').split(/\s+/).filter(Boolean);
    const hasValidationClass = classNames.includes(VALIDATION_NODE_CLASS);
    const shouldHighlight = invalidNodeIds.has(node.id);

    if (shouldHighlight && !hasValidationClass) {
      classNames.push(VALIDATION_NODE_CLASS);
      changed = true;
    } else if (!shouldHighlight && hasValidationClass) {
      changed = true;
      return {
        ...node,
        className: classNames
          .filter((className) => className !== VALIDATION_NODE_CLASS)
          .join(' '),
      };
    }

    if (shouldHighlight && !hasValidationClass) {
      return { ...node, className: classNames.join(' ') };
    }
    return node;
  });

  return changed ? updatedNodes : nodes;
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
  const [publishValidation, setPublishValidation] = useState<{
    message: string;
    issues: WorkflowValidationIssue[];
  } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const setNodeTypes = useDesignerStore((state) => state.setNodeTypes);

  // Load draft on mount
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [draft, nodeTypes] = await Promise.all([
          workflowService.getDraft(workflowId) as Promise<WorkflowDraft>,
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
            const issues = draft.validationErrors.issues ?? [];
            setPublishValidation({
              message:
                draft.validationErrors.message ?? 'Workflow validation failed.',
              issues,
            });
            setNodes((currentNodes) =>
              updateValidationHighlights(currentNodes, issues),
            );
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
    setPublishValidation(null);
    setNodes((currentNodes) => updateValidationHighlights(currentNodes, []));
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
  }, [workflowId, setIsSaving, setNodes]);

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
    setPublishValidation(null);

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
      if (err instanceof WorkflowPublishValidationError) {
        setPublishValidation({ message: err.message, issues: err.issues });
        setNodes((currentNodes) =>
          updateValidationHighlights(currentNodes, err.issues),
        );
      } else if (err instanceof Error) {
        setPublishValidation({ message: err.message, issues: [] });
      } else {
        setPublishValidation({ message: String(err), issues: [] });
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
      setPublishValidation(null);
      setNodes((currentNodes) => updateValidationHighlights(currentNodes, []));
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
      {publishValidation && (
        <PublishValidationAlert
          message={publishValidation.message}
          issues={publishValidation.issues}
          onFocusNode={(nodeId) =>
            useDesignerStore.getState().setSelectedNodeId(nodeId)
          }
          onDismiss={() => setPublishValidation(null)}
        />
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
