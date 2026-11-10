import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWorkflows } from '../hooks/useWorkflows';
import { useWorkflowMutations } from '../hooks/useWorkflowMutations';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Plus,
  Workflow as WorkflowIcon,
  Sparkles,
  Home,
  Layers,
} from 'lucide-react';
import type { WorkflowSummary } from '../types/workflow.types';
import { TemplateGalleryDialog } from '../components/TemplateGalleryDialog';
import { DeleteWorkflowDialog } from '../components/dialogs/DeleteWorkflowDialog';
import { WorkflowTable } from '../components/workflow-list/WorkflowTable';
import type { WorkflowTemplate } from '../templates/catalog';

export const WorkflowListPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: workflows, isLoading, isError, refetch } = useWorkflows();
  const {
    createWorkflowMutation,
    createFromTemplateMutation,
    renameWorkflowMutation,
    deleteWorkflowMutation,
  } = useWorkflowMutations();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingWorkflow, setDeletingWorkflow] = useState<WorkflowSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const creating = createWorkflowMutation.isPending;
  const savingName = renameWorkflowMutation.isPending;
  const deleting = deleteWorkflowMutation.isPending;
  const creatingTemplate = createFromTemplateMutation.isPending;

  const handleCreateFromTemplate = (template: WorkflowTemplate) => {
    setActionError(null);
    createFromTemplateMutation.mutate(template, {
      onSuccess: (workflowId) => {
        navigate(`/workflows/${workflowId}`);
      },
      onError: () => {
        setActionError('Could not create a workflow from this template. Please try again.');
      },
    });
  };

  const handleRename = () => {
    if (!editingId || !editingName.trim()) return;
    setActionError(null);
    renameWorkflowMutation.mutate(
      { id: editingId, name: editingName.trim() },
      {
        onSuccess: () => {
          setEditingId(null);
        },
        onError: () => {
          setActionError('Could not rename the workflow. Please try again.');
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deletingWorkflow) return;
    setActionError(null);
    deleteWorkflowMutation.mutate(deletingWorkflow.id, {
      onSuccess: () => {
        setDeletingWorkflow(null);
      },
      onError: () => {
        setActionError('Could not delete the workflow. Please try again.');
      },
    });
  };

  const handleCreateNew = () => {
    setActionError(null);
    createWorkflowMutation.mutate(undefined, {
      onSuccess: (newId) => {
        navigate(`/workflows/${newId}`);
      },
      onError: (err) => {
        console.error('Failed to create workflow', err);
        setActionError('Không thể tạo quy trình mới. Vui lòng thử lại!');
      },
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80"
            >
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-mono text-xs shadow-sm">
                FP
              </div>
              <span className="hidden sm:inline font-bold">FlowPilot</span>
            </Link>

            <span className="text-muted-foreground/40 text-sm">/</span>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Layers className="size-3.5" />
              <span>Workflows</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <Home className="size-3.5" />
                <span className="hidden sm:inline">Trang chủ</span>
              </Button>
            </Link>
            <Button
              onClick={handleCreateNew}
              disabled={creating}
              size="sm"
              className="gap-1.5 text-xs shadow-sm"
            >
              <Plus className="size-3.5" />
              <span>{creating ? 'Đang tạo...' : 'Tạo Workflow mới'}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 container mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {/* Header Hero Banner */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground font-mono mb-2">
              <Sparkles className="size-3 text-amber-500" />
              <span>Orchestration Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Danh sách Quy trình (Workflows)
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Quản lý các quy trình tự động hóa, mở bản thiết kế hoặc xem các phiên bản đã xuất bản để khởi chạy.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setTemplatesOpen(true)}
              className="w-fit gap-1.5 text-xs"
            >
              Browse templates
            </Button>
            <Button
              onClick={handleCreateNew}
              disabled={creating}
              className="w-fit gap-1.5 text-xs"
            >
              <Plus className="size-4" />
              <span>{creating ? 'Đang tạo...' : 'Tạo Workflow mới'}</span>
            </Button>
          </div>
        </div>

        {/* Content Area */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-3 text-sm text-muted-foreground">Đang tải danh sách quy trình...</p>
          </div>
        )}

        {isError && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive text-base">Không thể tải danh sách quy trình</CardTitle>
              <CardDescription>
                Vui lòng kiểm tra xem backend API đã được khởi động và kết nối ổn định hay chưa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Thử lại
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && (!workflows || workflows.length === 0) && (
          <Card className="border-dashed py-12 text-center">
            <CardContent className="flex flex-col items-center justify-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <WorkflowIcon className="size-6" />
              </div>
              <div className="max-w-md">
                <h3 className="text-base font-semibold">Chưa có quy trình nào</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bắt đầu tạo quy trình tự động hóa đầu tiên của bạn bằng cách nhấn nút &quot;Tạo Workflow mới&quot; bên dưới.
                </p>
              </div>
              <Button onClick={handleCreateNew} disabled={creating} size="sm" className="mt-2 text-xs gap-1.5">
                <Plus className="size-3.5" />
                <span>Tạo Workflow đầu tiên</span>
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && workflows && workflows.length > 0 && (
          <WorkflowTable
            workflows={workflows}
            editingId={editingId}
            editingName={editingName}
            savingName={savingName}
            deleting={deleting}
            onNavigateWorkflow={(id) => navigate(`/workflows/${id}`)}
            onNavigateVersions={(id) => navigate(`/workflows/${id}/versions`)}
            onStartRename={(wf) => {
              setEditingId(wf.id);
              setEditingName(wf.name);
            }}
            onChangeEditingName={setEditingName}
            onSaveRename={handleRename}
            onCancelRename={() => setEditingId(null)}
            onPromptDelete={setDeletingWorkflow}
          />
        )}
        {actionError && <p role="alert" className="mt-4 text-sm text-destructive">{actionError}</p>}
      </main>

      <TemplateGalleryDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onSelect={(template) => void handleCreateFromTemplate(template)}
        busy={creatingTemplate}
      />

      <DeleteWorkflowDialog
        workflow={deletingWorkflow}
        open={Boolean(deletingWorkflow)}
        isDeleting={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeletingWorkflow(null)}
      />
    </div>
  );
};
