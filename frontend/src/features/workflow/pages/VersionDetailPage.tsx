import React, { useCallback, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useNodesState, useEdgesState } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { useWorkflowVersion } from '../hooks/useWorkflowVersions';
import { useNodeTypes } from '../hooks/useWorkflowDraft';
import { useExecutionMonitor } from '../hooks/useExecutionMonitor';
import { ExecutionHistoryList } from '../components/ExecutionHistoryList';
import { mapExecutionNodeStates } from '../utils/execution-view.util';
import { triggerService } from '../services/trigger.service';
import type { ExecutionCanvasNodeData } from '../components/canvas/ExecutionCanvasNode';
import {
  mapDefinitionNodeToRunner,
  type RawDefinitionNode,
} from '../utils/version-canvas.util';

import { VersionHeader } from '../components/version-detail/VersionHeader';
import { ExecutionControlBar } from '../components/version-detail/ExecutionControlBar';
import { ExecutionResultStats } from '../components/version-detail/ExecutionResultStats';
import { VersionCanvas } from '../components/version-detail/VersionCanvas';
import { ExecutionNodeLogTable } from '../components/version-detail/ExecutionNodeLogTable';
import { VersionStructureCard } from '../components/version-detail/VersionStructureCard';

export const VersionDetailPage: React.FC = () => {
  const { workflowId = '', versionId = '' } = useParams<{
    workflowId: string;
    versionId: string;
  }>();

  const {
    data: version,
    isLoading,
    isError,
    refetch,
  } = useWorkflowVersion(workflowId, versionId);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ExecutionCanvasNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const handleBeforeRun = useCallback(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: {
          ...n.data,
          status: 'idle',
          outputSummary: undefined,
          errorMessage: undefined,
        },
      })),
    );
    setEdges((prev) =>
      prev.map((e) => ({
        ...e,
        animated: false,
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      })),
    );
  }, [setNodes, setEdges]);

  const {
    selectedExecutionId,
    selectExecution,
    executionResult,
    executionError,
    executionHistory,
    streamState,
    isPending,
    handleRun,
  } = useExecutionMonitor({
    workflowId,
    versionId,
    onBeforeRun: handleBeforeRun,
  });

  const definition = useMemo(() => {
    return (
      (version?.definition as {
        nodes?: RawDefinitionNode[];
        edges?: Array<{ id: string; source: string; target: string }>;
      }) || { nodes: [], edges: [] }
    );
  }, [version]);

  const rawNodes = useMemo(() => definition.nodes || [], [definition]);
  const rawEdges = useMemo(() => definition.edges || [], [definition]);

  const { data: catalog = [] } = useNodeTypes();
  const eventTriggerNode = rawNodes.find((n) =>
    triggerService.webhookHint(catalog.find((t) => t.key === n.data?.key)?.configSchema),
  );

  const initialNodes = useMemo(() => {
    return rawNodes.map((n, idx) => mapDefinitionNodeToRunner(n, idx, rawEdges));
  }, [rawNodes, rawEdges]);

  const initialEdges = useMemo(() => {
    return rawEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: false,
      style: { stroke: '#94a3b8', strokeWidth: 2 },
    }));
  }, [rawEdges]);

  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  useEffect(() => {
    if (!executionResult) return;
    setNodes((previous) => {
      const states = mapExecutionNodeStates(
        previous.map((node) => node.id),
        executionResult.nodeLogs ?? [],
      );
      return previous.map((node) => ({
        ...node,
        data: {
          ...node.data,
          status: 'idle',
          outputSummary: undefined,
          errorMessage: undefined,
          durationMs: undefined,
          ...states.get(node.id),
        },
      }));
    });
    setEdges((previous) =>
      previous.map((edge) => ({
        ...edge,
        animated: executionResult.status === 'QUEUED' || executionResult.status === 'RUNNING',
        style: {
          stroke:
            executionResult.status === 'SUCCESS'
              ? '#10b981'
              : executionResult.status === 'FAILED'
                ? '#f43f5e'
                : '#94a3b8',
          strokeWidth: 2,
        },
      })),
    );
  }, [executionResult, setNodes, setEdges]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <VersionHeader
        workflowId={workflowId}
        versionNumber={version?.versionNumber}
      />

      <main className="flex-1 container mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-3 text-sm text-muted-foreground">Loading version details…</p>
          </div>
        )}

        {isError && (
          <Card className="border-destructive/30 bg-destructive/5 mb-8">
            <CardHeader>
              <CardTitle className="text-destructive text-base">Version not found</CardTitle>
              <CardDescription>
                This version may have been deleted, or the link is invalid.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && version && (
          <div className="space-y-8">
            <ExecutionControlBar
              workflowId={workflowId}
              versionId={versionId}
              versionNumber={version.versionNumber}
              publishedAt={version.publishedAt}
              streamState={streamState}
              hasSelectedExecution={Boolean(selectedExecutionId)}
              isPending={isPending}
              onRun={handleRun}
              eventTriggerNode={eventTriggerNode}
            />

            {executionError && selectedExecutionId && (
              <Alert variant="destructive" role="alert">
                <AlertCircle className="size-4" />
                <AlertTitle>Execution could not be loaded</AlertTitle>
                <AlertDescription>
                  Refresh the selected run or choose another execution from history.
                </AlertDescription>
              </Alert>
            )}

            {executionHistory && (
              <ExecutionHistoryList
                executions={executionHistory}
                selectedId={selectedExecutionId}
                onSelect={selectExecution}
              />
            )}

            {executionResult && (
              <ExecutionResultStats executionResult={executionResult} />
            )}

            <VersionCanvas
              workflowId={workflowId}
              versionNumber={version.versionNumber}
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
            />

            {executionResult && (
              <ExecutionNodeLogTable nodeLogs={executionResult.nodeLogs} />
            )}

            <VersionStructureCard
              nodes={rawNodes}
              edgesCount={rawEdges.length}
            />
          </div>
        )}
      </main>
    </div>
  );
};
