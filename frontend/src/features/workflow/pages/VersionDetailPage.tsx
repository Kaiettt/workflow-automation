import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from '@xyflow/react';
import type { Node, Edge, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Activity,
  Layers,
  RotateCcw,
  ExternalLink,
  Loader2,
  Check,
  X,
  Webhook,
  GitFork,
  Database,
  Mail,
  Sparkles,
  Copy,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { useWorkflowVersion } from '../hooks/useWorkflowVersions';
import { useStartExecution } from '../hooks/useStartExecution';
import type { ExecutionResult } from '../types/execution.types';
import { countItems } from '../utils/node-config';
import { EventTriggerInfo } from '../components/EventTriggerInfo';
import { triggerService } from '../services/trigger.service';
import { workflowService } from '../services/workflow.service';
import { useQuery } from '@tanstack/react-query';

// --- Custom Interactive Canvas Node ---
interface RunnerNodeData extends Record<string, unknown> {
  label: string;
  category: string;
  iconType: 'webhook' | 'filter' | 'database' | 'mail' | 'action';
  detail: string;
  status: 'idle' | 'running' | 'success' | 'failed' | 'skipped';
  hasTarget: boolean;
  hasSource: boolean;
  outputSummary?: string;
  errorMessage?: string;
  durationMs?: number;
}

const RunnerNodeComponent: React.FC<NodeProps<Node<RunnerNodeData>>> = ({ data }) => {
  const getIcon = () => {
    switch (data.iconType) {
      case 'webhook':
        return <Webhook className="size-4 text-indigo-500" />;
      case 'filter':
        return <GitFork className="size-4 text-amber-500" />;
      case 'database':
        return <Database className="size-4 text-blue-500" />;
      case 'mail':
        return <Mail className="size-4 text-emerald-500" />;
      default:
        return <Sparkles className="size-4 text-primary" />;
    }
  };

  const getStatusBorder = () => {
    if (data.status === 'running')
      return 'border-indigo-500 ring-2 ring-indigo-500/30 shadow-indigo-500/20';
    if (data.status === 'success')
      return 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-emerald-500/10';
    if (data.status === 'failed')
      return 'border-rose-500 ring-2 ring-rose-500/20 shadow-rose-500/10';
    if (data.status === 'skipped') return 'border-dashed border-border opacity-60';
    return 'border-border hover:border-border/80';
  };

  return (
    <div
      className={`relative min-w-[200px] rounded-xl border bg-card p-3 shadow-md transition-all duration-300 ${getStatusBorder()}`}
    >
      {data.hasTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className="!size-3 !bg-zinc-400 !border-2 !border-card dark:!bg-zinc-600"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
            {data.label}
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          {data.category}
        </span>
      </div>

      {/* Body */}
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded truncate max-w-[140px]">
            {data.detail}
          </span>
          {data.status === 'running' && (
            <Loader2 className="size-3 text-indigo-500 animate-spin ml-1 shrink-0" />
          )}
          {data.status === 'success' && (
            <CheckCircle2 className="size-3.5 text-emerald-500 ml-1 shrink-0" />
          )}
          {data.status === 'failed' && (
            <XCircle className="size-3.5 text-rose-500 ml-1 shrink-0" />
          )}
          {data.status === 'skipped' && (
            <span className="ml-1 shrink-0 text-[10px] text-muted-foreground">Skipped</span>
          )}
        </div>

        {/* Live Mini Output Pill */}
        {data.outputSummary && data.status === 'success' && (
          <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
            <Check className="size-2.5 shrink-0" />
            <span className="truncate">{data.outputSummary}</span>
          </div>
        )}

        {/* Live Mini Error Pill */}
        {data.errorMessage && data.status === 'failed' && (
          <div className="text-[10px] font-mono text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 flex items-center gap-1">
            <X className="size-2.5 shrink-0" />
            <span className="truncate">{data.errorMessage}</span>
          </div>
        )}
      </div>

      {data.hasSource && (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-3 !bg-indigo-500 !border-2 !border-card"
        />
      )}
    </div>
  );
};

const nodeTypes = {
  runnerNode: RunnerNodeComponent,
  default: RunnerNodeComponent,
};

function mapDefinitionNodeToRunner(
  rawNode: {
    id: string;
    type?: string;
    position?: { x: number; y: number };
    data?: { key?: string; name?: string; config?: Record<string, unknown> };
  },
  idx: number,
  allEdges: Array<{ source: string; target: string }>,
): Node<RunnerNodeData> {
  const key = rawNode.data?.key || rawNode.type || '';
  const label = rawNode.data?.name || rawNode.data?.key || rawNode.id;

  let category = 'Action';
  let iconType: RunnerNodeData['iconType'] = 'action';
  let detail = key;

  if (
    key.startsWith('trigger.') ||
    key.endsWith('.trigger') ||
    key.includes('webhook') ||
    key.includes('manual')
  ) {
    category = 'Trigger';
    iconType = 'webhook';
    detail = key;
  } else if (key.startsWith('logic.') || key.includes('filter')) {
    category = 'Logic';
    iconType = 'filter';
    detail = rawNode.data?.config?.field
      ? `${String(rawNode.data.config.field)} ${String(rawNode.data?.config?.operator || '==')} ${String(rawNode.data?.config?.value || '')}`
      : 'amount >= 50';
  } else if (key.includes('postgres') || key.includes('db') || key.includes('sql') || key.includes('sheet')) {
    category = 'Action';
    iconType = 'database';
    detail = key.includes('sheet') ? 'readRows()' : 'INSERT orders';
  } else if (key.includes('mail') || key.includes('gmail')) {
    category = 'Action';
    iconType = 'mail';
    detail = 'sendMail()';
  }

  const hasTarget = allEdges.some((e) => e.target === rawNode.id);
  const hasSource = allEdges.some((e) => e.source === rawNode.id);

  return {
    id: rawNode.id,
    type: 'runnerNode',
    position: rawNode.position || { x: 40 + idx * 240, y: 120 },
    data: {
      label,
      category,
      iconType,
      detail,
      status: 'idle',
      hasTarget,
      hasSource,
    },
  };
}

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

  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState(false);

  const definition = useMemo(() => {
    return (
      (version?.definition as {
        nodes?: Array<{
          id: string;
          type?: string;
          position?: { x: number; y: number };
          data?: { key?: string; name?: string; config?: Record<string, unknown> };
        }>;
        edges?: Array<{ id: string; source: string; target: string }>;
      }) || { nodes: [], edges: [] }
    );
  }, [version]);

  const rawNodes = useMemo(() => definition.nodes || [], [definition]);
  // A version with an event trigger (a node type with x-webhook) is started
  // by its events while the workflow is Active, not by the Run button.
  const { data: catalog = [] } = useQuery({
    queryKey: ['node-types'],
    queryFn: () => workflowService.getNodeTypes(),
    staleTime: Infinity,
  });
  const eventTriggerNode = rawNodes.find((n) =>
    triggerService.webhookHint(catalog.find((t) => t.key === n.data?.key)?.configSchema),
  );
  const rawEdges = useMemo(() => definition.edges || [], [definition]);

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

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<RunnerNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const startExecutionMutation = useStartExecution({
    onSuccess: (data: ExecutionResult) => {
      setExecutionResult(data);

      // Update nodes on canvas with actual backend results
      setNodes((prev) =>
        prev.map((n) => {
          const log = data.nodeLogs?.find((l) => l.nodeId === n.id);
          if (log) {
            if (log.status === 'SUCCESS') {
              return {
                ...n,
                data: {
                  ...n.data,
                  status: 'success',
                  outputSummary: `✓ Thành công (${log.durationMs ?? 0}ms)`,
                  errorMessage: undefined,
                  durationMs: log.durationMs ?? undefined,
                },
              };
            } else if (log.status === 'SKIPPED') {
              return {
                ...n,
                data: {
                  ...n.data,
                  status: 'skipped',
                  outputSummary: undefined,
                  errorMessage: undefined,
                  durationMs: undefined,
                },
              };
            } else {
              return {
                ...n,
                data: {
                  ...n.data,
                  status: 'failed',
                  outputSummary: undefined,
                  errorMessage: log.errorMessage || 'Lỗi thực thi',
                  durationMs: log.durationMs ?? undefined,
                },
              };
            }
          }
          return n;
        }),
      );

      // Animate edges
      setEdges((prev) =>
        prev.map((e) => ({
          ...e,
          animated: true,
          style: {
            stroke: data.status === 'SUCCESS' ? '#10b981' : '#f43f5e',
            strokeWidth: 2,
          },
        })),
      );
    },
    onError: (err: unknown) => {
      console.error('Run execution error:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Đã xảy ra lỗi trong quá trình thực thi quy trình.';
      alert(`Lỗi thực thi: ${message}`);
    },
  });

  const handleRun = useCallback(() => {
    if (!versionId || startExecutionMutation.isPending) return;

    // Reset canvas to running
    setNodes((prev) =>
      prev.map((n, idx) => ({
        ...n,
        data: {
          ...n.data,
          status: idx === 0 ? 'running' : 'idle',
          outputSummary: undefined,
          errorMessage: undefined,
        },
      })),
    );

    setEdges((prev) =>
      prev.map((e) => ({
        ...e,
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2 },
      })),
    );

    startExecutionMutation.mutate({
      workflow_version_id: versionId,
    });
  }, [versionId, startExecutionMutation, setNodes, setEdges]);


  const toggleExpandNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const copyExecutionId = (id: string) => {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const isPending = startExecutionMutation.isPending;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 text-xs truncate">
            <Link
              to="/workflows"
              className="text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              Workflows
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <Link
              to={`/workflows/${workflowId}/versions`}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              <ChevronLeft className="size-3.5" />
              <span>Phiên bản</span>
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-semibold text-foreground">
              v{version?.versionNumber ?? '...'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link to={`/workflows/${workflowId}`}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8">
                <ExternalLink className="size-3.5" />
                <span className="hidden sm:inline">Mở Designer</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 container mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-3 text-sm text-muted-foreground">Đang tải chi tiết phiên bản...</p>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <Card className="border-destructive/30 bg-destructive/5 mb-8">
            <CardHeader>
              <CardTitle className="text-destructive text-base">Không tìm thấy phiên bản này</CardTitle>
              <CardDescription>
                Phiên bản có thể đã bị xóa hoặc liên kết không hợp lệ.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Thử lại
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && version && (
          <div className="space-y-8">
            {/* Version Overview Card */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Badge variant="default" className="text-sm font-mono px-3 py-1 font-bold">
                    Phiên bản v{version.versionNumber}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3.5" />
                    Xuất bản: {new Date(version.publishedAt).toLocaleString('vi-VN')}
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Chi tiết Phiên bản &amp; Kích hoạt Run UI
                </h1>
                <p className="text-sm text-muted-foreground">
                  Workflow ID: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{workflowId}</code> • Version ID: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{version.id}</code>
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {eventTriggerNode ? (
                  <EventTriggerInfo
                    workflowId={workflowId}
                    versionId={versionId}
                    triggerName={String(eventTriggerNode.data?.name ?? eventTriggerNode.id)}
                  />
                ) : (
                  <Button
                    size="lg"
                    onClick={handleRun}
                    disabled={isPending}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 font-semibold px-6 shadow-md transition-all"
                  >
                    {isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : executionResult ? (
                      <RotateCcw className="size-4" />
                    ) : (
                      <Play className="size-4 fill-current" />
                    )}
                    <span>
                      {isPending
                        ? 'Đang thực thi Engine...'
                        : executionResult
                          ? 'Chạy lại phiên bản (Rerun)'
                          : 'Kích hoạt chạy ngay (Run)'}
                    </span>
                  </Button>
                )}
              </div>
            </div>

            {/* Execution Result Stat Cards (Real Backend Execution Result) */}
            {executionResult && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Activity className="size-5 text-primary" />
                  <h2 className="text-lg font-bold">Kết quả thực thi (Execution Run Result)</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Status Badge Card */}
                  <Card className="p-4 flex flex-col justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Trạng thái tổng thể</span>
                    <div className="mt-2 flex items-center gap-2">
                      {executionResult.status === 'SUCCESS' ? (
                        <>
                          <CheckCircle2 className="size-5 text-emerald-500" />
                          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            SUCCESS
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="size-5 text-destructive" />
                          <span className="text-base font-bold text-destructive font-mono">
                            {executionResult.status}
                          </span>
                        </>
                      )}
                    </div>
                  </Card>

                  {/* Duration Card */}
                  <Card className="p-4 flex flex-col justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Thời gian thực thi</span>
                    <div className="mt-2 text-xl font-bold font-mono text-foreground">
                      {executionResult.durationMs ?? 0} ms
                    </div>
                  </Card>

                  {/* Started At Card */}
                  <Card className="p-4 flex flex-col justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Thời gian bắt đầu</span>
                    <div className="mt-2 text-sm font-semibold font-mono text-foreground">
                      {new Date(executionResult.startedAt).toLocaleTimeString('vi-VN')}
                    </div>
                  </Card>

                  {/* Execution ID Card */}
                  <Card className="p-4 flex flex-col justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Execution ID</span>
                    <div className="mt-2 flex items-center justify-between text-xs font-mono text-muted-foreground">
                      <span className="truncate max-w-[130px]" title={executionResult.id}>
                        {executionResult.id}
                      </span>
                      <button
                        onClick={() => copyExecutionId(executionResult.id)}
                        className="p-1 hover:text-foreground rounded"
                        title="Sao chép Execution ID"
                      >
                        {copiedId ? (
                          <Check className="size-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Interactive Visual Graph Canvas (Matching Image 2) */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden text-left">
              {/* Canvas Header / Toolbar */}
              <div className="flex flex-wrap items-center justify-between border-b border-border px-4 py-2.5 bg-muted/40 gap-3">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="font-semibold text-foreground">
                    workflow_v{version.versionNumber}.flow
                  </span>
                  <span className="text-border">/</span>
                  <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    Live Runner Canvas
                  </span>
                  <span className="text-muted-foreground text-[10px] hidden sm:inline">
                    ({rawNodes.length} nodes, {rawEdges.length} edges)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Link to={`/workflows/${workflowId}`}>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 rounded-lg bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-medium px-3 gap-1.5"
                    >
                      <ExternalLink className="size-3.5" />
                      <span>Open in Designer</span>
                    </Button>
                  </Link>
                </div>
              </div>

              {/* React Flow Canvas */}
              <div className="relative h-[340px] w-full bg-background">
                <ReactFlowProvider>
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.25 }}
                    minZoom={0.5}
                    maxZoom={1.5}
                    nodesDraggable={true}
                    nodesConnectable={false}
                    elementsSelectable={true}
                  >
                    <Background color="var(--border)" gap={20} size={1} />
                    <Controls
                      showInteractive={false}
                      className="!bg-card !border-border !shadow-sm !rounded-lg"
                    />
                  </ReactFlow>
                </ReactFlowProvider>
              </div>
            </div>

            {/* Per-Node Execution Logs Table (Expanded details with Input / Output / Error) */}
            {executionResult && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Nhật ký thực thi từng bước (Node Logs)</CardTitle>
                      <CardDescription>
                        Chi tiết dữ liệu đầu vào (input), đầu ra (output) và thông báo lỗi của từng node trong luồng.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      {executionResult.nodeLogs?.length ?? 0} bước đã chạy
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Bước (Node)</TableHead>
                        <TableHead>Loại Node</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Thời gian</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executionResult.nodeLogs && executionResult.nodeLogs.length > 0 ? (
                        executionResult.nodeLogs.map((log, index) => {
                          const isExpanded = !!expandedNodes[log.nodeId];
                          const isNodeSuccess = log.status === 'SUCCESS';
                          const isNodeSkipped = log.status === 'SKIPPED';

                          return (
                            <React.Fragment key={log.id || log.nodeId}>
                              <TableRow
                                className="cursor-pointer hover:bg-muted/30 transition-colors"
                                onClick={() => toggleExpandNode(log.nodeId)}
                              >
                                <TableCell className="text-center p-2">
                                  {isExpanded ? (
                                    <ChevronDown className="size-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="size-4 text-muted-foreground" />
                                  )}
                                </TableCell>

                                <TableCell className="font-medium text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="flex size-5 items-center justify-center rounded-full bg-muted font-mono text-[10px] text-muted-foreground">
                                      {index + 1}
                                    </span>
                                    <span>{log.nodeId}</span>
                                  </div>
                                  {countItems(log.input) !== null && (
                                    <div className="mt-0.5 ml-7 text-[11px] font-normal text-muted-foreground">
                                      {countItems(log.input)} in
                                      {countItems(log.output) !== null &&
                                        ` → ${countItems(log.output)} out`}
                                    </div>
                                  )}
                                </TableCell>

                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {log.nodeKey}
                                </TableCell>

                                <TableCell>
                                  {isNodeSuccess ? (
                                    <Badge
                                      variant="outline"
                                      className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1 text-[11px]"
                                    >
                                      <CheckCircle2 className="size-3" />
                                      <span>SUCCESS ({log.durationMs ?? 0}ms)</span>
                                    </Badge>
                                  ) : isNodeSkipped ? (
                                    <Badge
                                      variant="outline"
                                      className="gap-1 text-[11px] text-muted-foreground"
                                    >
                                      <span>SKIPPED</span>
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="destructive"
                                      className="gap-1 text-[11px]"
                                    >
                                      <XCircle className="size-3" />
                                      <span>FAILED</span>
                                    </Badge>
                                  )}
                                </TableCell>

                                <TableCell className="text-xs text-muted-foreground font-mono">
                                  {log.startedAt
                                    ? new Date(log.startedAt).toLocaleTimeString('vi-VN')
                                    : '—'}
                                </TableCell>
                              </TableRow>

                              {/* Expanded Log Detail */}
                              {isExpanded && (
                                <TableRow className="bg-muted/10">
                                  <TableCell colSpan={5} className="p-4 space-y-3">
                                    {log.errorMessage && (
                                      <Alert variant="destructive" className="py-2.5">
                                        <AlertCircle className="size-4" />
                                        <AlertTitle className="text-xs font-bold">Lỗi thực thi</AlertTitle>
                                        <AlertDescription className="text-xs font-mono break-all mt-1">
                                          {log.errorMessage}
                                        </AlertDescription>
                                      </Alert>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                                      <div className="rounded-lg border border-border bg-card p-3">
                                        <div className="text-muted-foreground font-semibold mb-1 text-[11px] uppercase tracking-wider">
                                          Input Data
                                        </div>
                                        <pre className="max-h-48 overflow-auto text-[11px] text-foreground p-2 rounded bg-muted/40">
                                          {JSON.stringify(log.input, null, 2) ?? 'null'}
                                        </pre>
                                      </div>

                                      <div className="rounded-lg border border-border bg-card p-3">
                                        <div className="text-muted-foreground font-semibold mb-1 text-[11px] uppercase tracking-wider">
                                          Output Data
                                        </div>
                                        <pre className="max-h-48 overflow-auto text-[11px] text-foreground p-2 rounded bg-muted/40">
                                          {JSON.stringify(log.output, null, 2) ?? 'null'}
                                        </pre>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="py-6 text-center text-muted-foreground text-xs">
                            Không có nhật ký node nào được ghi nhận.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Read-only Frozen Node Structure */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="size-4 text-primary" />
                      <span>Cấu trúc quy trình trong phiên bản ({rawNodes.length} nodes, {rawEdges.length} edges)</span>
                    </CardTitle>
                    <CardDescription>
                      Tóm tắt các bước tuần tự được đóng băng trong phiên bản này.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {rawNodes.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground text-sm">
                    Phiên bản này không có node nào.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rawNodes.map((node, i) => (
                      <div
                        key={node.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-border bg-muted/20 gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-xs font-bold">
                            {i + 1}
                          </span>
                          <div>
                            <div className="font-semibold text-sm">
                              {node.data?.name || node.id}
                            </div>
                            <div className="text-xs font-mono text-muted-foreground">
                              {node.data?.key || node.type || 'standard-node'}
                            </div>
                          </div>
                        </div>

                        {node.data?.config && Object.keys(node.data.config).length > 0 && (
                          <div className="text-[11px] font-mono bg-muted/60 px-2.5 py-1 rounded text-muted-foreground max-w-md truncate">
                            {JSON.stringify(node.data.config)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};
