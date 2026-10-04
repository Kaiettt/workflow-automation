import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWorkflowVersion } from '../hooks/useWorkflowVersions';
import { useStartExecution } from '../hooks/useStartExecution';
import type { ExecutionResult } from '../types/execution.types';
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
import {
  ChevronLeft,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Activity,
  Layers,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  LogIn,
} from 'lucide-react';
import { useAuthStore, UserDropdown, AuthModal } from '@/features/auth';

export const VersionDetailPage: React.FC = () => {
  const { workflowId = '', versionId = '' } = useParams<{
    workflowId: string;
    versionId: string;
  }>();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const {
    data: version,
    isLoading,
    isError,
    refetch,
  } = useWorkflowVersion(workflowId, versionId);

  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const startExecutionMutation = useStartExecution({
    onSuccess: (data) => {
      setExecutionResult(data);
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

  const handleRun = () => {
    if (!versionId) return;
    startExecutionMutation.mutate({
      workflow_version_id: versionId,
    });
  };

  const toggleExpandNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const definition = version?.definition as
    | {
        nodes?: Array<{
          id: string;
          type?: string;
          data?: { key?: string; name?: string; config?: Record<string, unknown> };
        }>;
        edges?: Array<{ id: string; source: string; target: string }>;
      }
    | undefined;

  const nodes = definition?.nodes || [];
  const edges = definition?.edges || [];

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
            {isAuthenticated ? (
              <UserDropdown />
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAuthModalOpen(true)}
                className="gap-1.5 text-xs h-8"
              >
                <LogIn className="size-3.5" />
                <span>Đăng nhập</span>
              </Button>
            )}
            <Button
              onClick={handleRun}
              disabled={startExecutionMutation.isPending || isLoading}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-sm"
            >
              <Play className="size-3.5 fill-current" />
              <span>
                {startExecutionMutation.isPending
                  ? 'Đang thực thi Engine...'
                  : 'Chạy phiên bản (Run)'}
              </span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 container mx-auto max-w-7xl px-4 sm:px-6 py-8">
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
                  Chi tiết Phiên bản & Kích hoạt Run UI
                </h1>
                <p className="text-sm text-muted-foreground">
                  Workflow ID: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{workflowId}</code> • Version ID: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{version.id}</code>
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Button
                  size="lg"
                  onClick={handleRun}
                  disabled={startExecutionMutation.isPending}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 font-semibold px-6 shadow-md"
                >
                  <Play className="size-4 fill-current" />
                  <span>
                    {startExecutionMutation.isPending
                      ? 'Đang thực thi Engine...'
                      : 'Kích hoạt chạy ngay (Run)'}
                  </span>
                </Button>
              </div>
            </div>

            {/* Execution Result Banner & Logs (If Executed) */}
            {executionResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="size-5 text-primary" />
                    <h2 className="text-lg font-bold">Kết quả thực thi (Execution Run Result)</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRun}
                    disabled={startExecutionMutation.isPending}
                    className="text-xs gap-1.5"
                  >
                    <RotateCcw className="size-3.5" />
                    <span>Chạy lại (Rerun)</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Status Badge Card */}
                  <Card className="p-4 flex flex-col justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Trạng thái tổng thể</span>
                    <div className="mt-2 flex items-center gap-2">
                      {executionResult.status === 'SUCCESS' ? (
                        <>
                          <CheckCircle2 className="size-5 text-emerald-500" />
                          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                            SUCCESS
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="size-5 text-destructive" />
                          <span className="text-lg font-bold text-destructive">
                            FAILED
                          </span>
                        </>
                      )}
                    </div>
                  </Card>

                  {/* Duration */}
                  <Card className="p-4 flex flex-col justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Thời gian thực thi</span>
                    <div className="mt-2">
                      <span className="text-lg font-bold font-mono">
                        {executionResult.durationMs != null ? `${executionResult.durationMs} ms` : '—'}
                      </span>
                    </div>
                  </Card>

                  {/* Started At */}
                  <Card className="p-4 flex flex-col justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Thời gian bắt đầu</span>
                    <div className="mt-2 text-xs font-mono text-foreground truncate">
                      {new Date(executionResult.startedAt).toLocaleTimeString('vi-VN')}
                    </div>
                  </Card>

                  {/* Execution ID */}
                  <Card className="p-4 flex flex-col justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Execution ID</span>
                    <div className="mt-2 text-xs font-mono text-muted-foreground truncate" title={executionResult.id}>
                      {executionResult.id}
                    </div>
                  </Card>
                </div>

                {/* Per-Node Logs Table */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Nhật ký thực thi từng bước (Node Logs)</CardTitle>
                    <CardDescription>
                      Chi tiết dữ liệu đầu vào (input), đầu ra (output) và thông báo lỗi của từng node trong luồng.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="w-[50px]"></TableHead>
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
                            return (
                              <React.Fragment key={log.nodeId || index}>
                                <TableRow
                                  className="cursor-pointer hover:bg-muted/30"
                                  onClick={() => toggleExpandNode(log.nodeId)}
                                >
                                  <TableCell className="text-center">
                                    {isExpanded ? (
                                      <ChevronDown className="size-4 text-muted-foreground inline" />
                                    ) : (
                                      <ChevronRight className="size-4 text-muted-foreground inline" />
                                    )}
                                  </TableCell>

                                  <TableCell className="font-semibold text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className="flex size-5 items-center justify-center rounded-full bg-muted font-mono text-[10px] text-muted-foreground">
                                        {index + 1}
                                      </span>
                                      <span>{log.nodeId}</span>
                                    </div>
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
                                        <span>SUCCESS</span>
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
              </div>
            )}

            {/* Read-only Node Summary of the Snapshot */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="size-4 text-primary" />
                      <span>Cấu trúc quy trình trong phiên bản ({nodes.length} nodes, {edges.length} edges)</span>
                    </CardTitle>
                    <CardDescription>
                      Tóm tắt các bước tuần tự được đóng băng trong phiên bản này.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {nodes.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground text-sm">
                    Phiên bản này không có node nào.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {nodes.map((node, i) => (
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

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultTab="login"
      />
    </div>
  );
};
