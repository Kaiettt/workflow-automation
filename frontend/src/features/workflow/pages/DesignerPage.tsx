import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNodesState, useEdgesState, useReactFlow, ReactFlowProvider } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { workflowService } from '../services/workflow.service';
import { DesignerLayout } from '../components/DesignerLayout';
import { VersionHistoryDialog } from '../components/VersionHistoryDialog';
import { useDesignerStore } from '../store/designer.store';
import { PublishValidationDialog } from '../components/PublishValidationDialog';
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

function DesignerPageInner({ workflowId: propWorkflowId, onBack: propOnBack }: DesignerPageProps) {
  const { workflowId: paramWorkflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const workflowId = propWorkflowId || paramWorkflowId || '';
  const onBack = propOnBack || (() => navigate('/workflows'));

  const { setCenter, getNode } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);

  const isSaving = useDesignerStore((state) => state.isSaving);
  const setIsSaving = useDesignerStore((state) => state.setIsSaving);
  const setValidationIssues = useDesignerStore((state) => state.setValidationIssues);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);
  const [publishValidation, setPublishValidation] = useState<{
    message: string;
    issues: WorkflowValidationIssue[];
  } | null>(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
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
            setValidationIssues(issues);
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
  }, [workflowId, setNodes, setEdges, setNodeTypes, setValidationIssues]);

  // Auto-save logic (debounced)
  const saveDraft = useCallback(async (currentNodes: Node[], currentEdges: Edge[]) => {
    setIsSaving(true);
    try {
      const definition = {
        nodes: currentNodes,
        edges: currentEdges,
        viewport: { x: 0, y: 0, zoom: 1 },
      };
      await workflowService.saveDraft(workflowId, definition);
    } catch (error) {
      console.error('Failed to save draft', error);
    } finally {
      setIsSaving(false);
    }
  }, [workflowId, setIsSaving]);

  useEffect(() => {
    if (loading) return;
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
    setValidationDialogOpen(false);

    // Ensure latest changes are saved first
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    await saveDraft(nodes, edges);

    try {
      await workflowService.publishWorkflow(workflowId);
      setPublishValidation(null);
      setValidationDialogOpen(false);
      useDesignerStore.getState().setValidationIssues([]);
      setNodes((currentNodes) => updateValidationHighlights(currentNodes, []));
      if (
        window.confirm(
          'Workflow published successfully! Would you like to view the version history and run it?',
        )
      ) {
        navigate(`/workflows/${workflowId}/versions`);
      }
    } catch (err: unknown) {
      if (err instanceof WorkflowPublishValidationError) {
        setPublishValidation({ message: err.message, issues: err.issues });
        setValidationDialogOpen(true);
        useDesignerStore.getState().setValidationIssues(err.issues);
        setNodes((currentNodes) =>
          updateValidationHighlights(currentNodes, err.issues),
        );
      } else if (err instanceof Error) {
        setPublishValidation({ message: err.message, issues: [] });
        setValidationDialogOpen(true);
      } else {
        setPublishValidation({ message: String(err), issues: [] });
        setValidationDialogOpen(true);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleFocusNode = useCallback(
    (nodeId: string) => {
      setValidationDialogOpen(false);
      useDesignerStore.getState().setSelectedNodeId(nodeId);

      const targetNode = getNode(nodeId) || nodes.find((n) => n.id === nodeId);
      if (targetNode?.position) {
        setCenter(targetNode.position.x + 96, targetNode.position.y + 38, {
          zoom: 1.25,
          duration: 600,
        });
      }
    },
    [getNode, nodes, setCenter],
  );

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
      setValidationDialogOpen(false);
      useDesignerStore.getState().setValidationIssues([]);
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
      <PublishValidationDialog
        open={validationDialogOpen}
        onOpenChange={setValidationDialogOpen}
        message={publishValidation?.message}
        issues={publishValidation?.issues ?? []}
        nodes={nodes}
        onSelectNode={handleFocusNode}
      />
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
        validationIssuesCount={
          publishValidation
            ? Math.max(publishValidation.issues.length, publishValidation.message ? 1 : 0)
            : 0
        }
        onOpenValidation={() => setValidationDialogOpen(true)}
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

export function DesignerPage(props: DesignerPageProps) {
  return (
    <ReactFlowProvider>
      <DesignerPageInner {...props} />
    </ReactFlowProvider>
  );
}
