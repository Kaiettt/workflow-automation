import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNodesState, useEdgesState, useReactFlow, ReactFlowProvider } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { DesignerLayout } from '../components/DesignerLayout';
import { VersionHistoryDialog } from '../components/VersionHistoryDialog';
import { useDesignerStore } from '../store/designer.store';
import { PublishValidationDialog } from '../components/PublishValidationDialog';
import {
  WorkflowPublishValidationError,
  type WorkflowValidationIssue,
} from '../models/workflow-validation.model';
import { resolveOutputs, outputOfHandle } from '../utils/node-outputs';
import type { WorkflowTemplate } from '../templates/catalog';
import { useWorkflowDraft, useNodeTypes } from '../hooks/useWorkflowDraft';
import { useWorkflowMutations } from '../hooks/useWorkflowMutations';
import { useDraftAutoSave } from '../hooks/useDraftAutoSave';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DesignerPageProps {
  workflowId?: string;
  onBack?: () => void;
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

  // React Query hooks for server state
  const { data: draft, isLoading: isDraftLoading } = useWorkflowDraft(workflowId);
  const { data: nodeTypes, isLoading: isNodeTypesLoading } = useNodeTypes();
  const loading = isDraftLoading || isNodeTypesLoading;

  const { publishWorkflowMutation } = useWorkflowMutations();
  const isPublishing = publishWorkflowMutation.isPending;

  const setValidationIssues = useDesignerStore((state) => state.setValidationIssues);
  const setNodeTypes = useDesignerStore((state) => state.setNodeTypes);

  const { isSaving, forceSave } = useDraftAutoSave({
    workflowId,
    nodes,
    edges,
    loading,
    debounceMs: 2000,
  });

  const [publishValidation, setPublishValidation] = useState<{
    message: string;
    issues: WorkflowValidationIssue[];
  } | null>(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Dialog state replacements for window.confirm
  const [publishSuccessInfo, setPublishSuccessInfo] = useState<{
    versionNumber: number;
    isActive: boolean;
  } | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<WorkflowTemplate | null>(null);

  // Synchronize draft definition into React Flow state
  useEffect(() => {
    if (!draft) return;

    if (draft.definition) {
      const rawNodes = (draft.definition.nodes || []) as Node[];
      const safeNodes = rawNodes.map((n, idx) => ({
        ...n,
        position: n.position || { x: 250, y: 100 + idx * 120 },
      }));
      setNodes(safeNodes);
      setEdges(draft.definition.edges || []);
    }
    if (draft.validationErrors) {
      const issues = draft.validationErrors.issues ?? [];
      setPublishValidation({
        message: draft.validationErrors.message ?? 'Workflow validation failed.',
        issues,
      });
      setValidationIssues(issues);
      setNodes((currentNodes) => updateValidationHighlights(currentNodes, issues));
    }
  }, [draft, setNodes, setEdges, setValidationIssues]);

  // Synchronize node types definition into designer store
  useEffect(() => {
    if (nodeTypes) {
      setNodeTypes(nodeTypes);
    }
  }, [nodeTypes, setNodeTypes]);

  const handleNodeDataChange = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return { ...n, data };
        }
        return n;
      })
    );
    // A deleted Switch rule takes its connections with it.
    const schema = useDesignerStore.getState().nodeTypes.find((t) => t.key === data.key)?.configSchema;
    const kept = new Set(resolveOutputs(schema, data.config).map((output) => output.key));
    setEdges((eds) => {
      const next = eds.filter((edge) => {
        const output = edge.source === nodeId ? outputOfHandle(edge.sourceHandle) : null;
        return output === null || kept.has(output);
      });
      return next.length === eds.length ? eds : next;
    });
  }, [setNodes, setEdges]);

  const handlePublish = async () => {
    setPublishValidation(null);
    setValidationDialogOpen(false);

    // Ensure latest changes are saved first
    await forceSave();

    try {
      const published = await publishWorkflowMutation.mutateAsync(workflowId);
      setPublishValidation(null);
      setValidationDialogOpen(false);
      useDesignerStore.getState().setValidationIssues([]);
      setNodes((currentNodes) => updateValidationHighlights(currentNodes, []));

      const activation = published.activation;
      if (activation && (activation.error || !activation.active)) {
        // The new version could not listen.
        const reason = activation.error ?? 'its triggers could not listen';
        setPublishValidation({
          message: activation.active
            ? `Published version ${published.versionNumber}, but it could not start listening: ${reason}. The previous version keeps answering events. Fix it and publish again.`
            : `Published version ${published.versionNumber}, but the workflow was turned off: ${reason}. Fix it, publish, then activate again.`,
          issues: [],
        });
        setValidationDialogOpen(true);
        return;
      }

      setPublishSuccessInfo({
        versionNumber: published.versionNumber,
        isActive: Boolean(published.activation?.active),
      });
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

  const applyTemplate = useCallback(
    async (template: WorkflowTemplate) => {
      const nextNodes = structuredClone(template.nodes);
      const nextEdges = structuredClone(template.edges);
      setNodes(nextNodes);
      setEdges(nextEdges);
      useDesignerStore.getState().setSelectedNodeId(null);
      await forceSave(nextNodes, nextEdges);
      setPendingTemplate(null);
    },
    [forceSave, setNodes, setEdges],
  );

  const handleUseTemplate = useCallback(
    async (template: WorkflowTemplate) => {
      if (nodes.length > 0) {
        setPendingTemplate(template);
        return false;
      }
      await applyTemplate(template);
      return true;
    },
    [applyTemplate, nodes.length],
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
        workflowId={workflowId}
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
        onUseTemplate={handleUseTemplate}
      />
      <VersionHistoryDialog
        workflowId={workflowId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRestoreSuccess={handleRestoreSuccess}
      />

      {/* Publish Success Dialog */}
      <Dialog
        open={Boolean(publishSuccessInfo)}
        onOpenChange={(open) => {
          if (!open) setPublishSuccessInfo(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workflow Published</DialogTitle>
            <DialogDescription>
              {publishSuccessInfo?.isActive
                ? `Version ${publishSuccessInfo.versionNumber} is now published and listening for events.`
                : `Version ${publishSuccessInfo?.versionNumber} has been published successfully.`}{' '}
              Would you like to view the version history and run it?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPublishSuccessInfo(null)}
            >
              Stay in Designer
            </Button>
            <Button
              onClick={() => {
                setPublishSuccessInfo(null);
                navigate(`/workflows/${workflowId}/versions`);
              }}
            >
              View Version History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Replacement Confirmation Dialog */}
      <Dialog
        open={Boolean(pendingTemplate)}
        onOpenChange={(open) => {
          if (!open) setPendingTemplate(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace Current Draft?</DialogTitle>
            <DialogDescription>
              Applying the “{pendingTemplate?.title}” template will overwrite your existing canvas nodes and connections. Any unsaved changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingTemplate(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingTemplate) void applyTemplate(pendingTemplate);
              }}
            >
              Replace Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
