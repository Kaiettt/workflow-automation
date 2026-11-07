import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWorkflows } from '../hooks/useWorkflows';
import { workflowService } from '../services/workflow.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Plus,
  GitBranch,
  ArrowRight,
  Workflow as WorkflowIcon,
  Clock,
  Sparkles,
  Home,
  Layers,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { WorkflowSummary } from '../types/workflow.types';
import { TemplateGalleryDialog } from '../components/TemplateGalleryDialog';
import type { WorkflowTemplate } from '../templates/catalog';

export const WorkflowListPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: workflows, isLoading, isError, refetch } = useWorkflows();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [deletingWorkflow, setDeletingWorkflow] = useState<WorkflowSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  const handleCreateFromTemplate = async (template: WorkflowTemplate) => {
    try {
      setCreatingTemplate(true);
      const workflowId = await workflowService.createWorkflow(template.title);
      await workflowService.saveDraft(workflowId, {
        nodes: structuredClone(template.nodes),
        edges: structuredClone(template.edges),
        viewport: { x: 0, y: 0, zoom: 1 },
      });
      navigate(`/workflows/${workflowId}`);
    } catch {
      setActionError('Could not create a workflow from this template. Please try again.');
    } finally {
      setCreatingTemplate(false);
    }
  };

  const handleRename = async () => {
    if (!editingId || !editingName.trim()) return;
    try {
      setSavingName(true);
      await workflowService.renameWorkflow(editingId, editingName.trim());
      setEditingId(null);
      await refetch();
    } catch {
      setActionError('Could not rename the workflow. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingWorkflow) return;
    try {
      setDeleting(true);
      await workflowService.deleteWorkflow(deletingWorkflow.id);
      setDeletingWorkflow(null);
      await refetch();
    } catch {
      setActionError('Could not delete the workflow. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateNew = async () => {
    try {
      setCreating(true);
      const newId = await workflowService.createWorkflow();
      navigate(`/workflows/${newId}`);
    } catch (err) {
      console.error('Failed to create workflow', err);
      alert('Không thể tạo quy trình mới. Vui lòng thử lại!');
    } finally {
      setCreating(false);
    }
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
                  Bắt đầu tạo quy trình tự động hóa đầu tiên của bạn bằng cách nhấn nút "Tạo Workflow mới" bên dưới.
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
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[300px]">Tên Workflow</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="hidden md:table-cell">Ngày tạo</TableHead>
                  <TableHead className="hidden sm:table-cell">Cập nhật gần nhất</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((wf) => (
                  <TableRow key={wf.id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <WorkflowIcon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          {editingId === wf.id ? (
                            <div className="flex items-center gap-1">
                              <Input aria-label="Workflow name" autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void handleRename(); if (event.key === 'Escape') setEditingId(null); }} className="h-8 min-w-32" />
                              <Button size="sm" className="h-8" disabled={!editingName.trim() || savingName} onClick={() => void handleRename()}>{savingName ? 'Saving…' : 'Save'}</Button>
                              <Button size="sm" variant="ghost" className="h-8" disabled={savingName} onClick={() => setEditingId(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <button type="button" className="text-left font-semibold text-foreground text-sm hover:underline" onClick={() => navigate(`/workflows/${wf.id}`)}>
                              {wf.name || 'Untitled workflow'}
                            </button>
                          )}
                          <div className="text-[11px] font-mono text-muted-foreground truncate max-w-[200px]">
                            {wf.id}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="font-mono text-[11px] uppercase">
                          {wf.status || 'DRAFT'}
                        </Badge>
                        {wf.active && (
                          <Badge variant="secondary" className="text-[11px] text-emerald-700">
                            Active
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3" />
                        <span>{wf.createdAt ? new Date(wf.createdAt).toLocaleDateString('vi-VN') : '—'}</span>
                      </div>
                    </TableCell>

                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      <span>{wf.updatedAt ? new Date(wf.updatedAt).toLocaleString('vi-VN') : '—'}</span>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => navigate(`/workflows/${wf.id}/versions`)}
                        >
                          <GitBranch className="size-3 text-primary" />
                          <span>Phiên bản (Versions)</span>
                        </Button>

                        <Button
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => navigate(`/workflows/${wf.id}`)}
                        >
                          <span>Mở Designer</span>
                          <ArrowRight className="size-3" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Rename ${wf.name}`} title="Rename workflow" disabled={savingName || deleting} onClick={() => { setEditingId(wf.id); setEditingName(wf.name); }}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Delete ${wf.name}`} title="Delete workflow" className="text-destructive hover:text-destructive" disabled={deleting} onClick={() => setDeletingWorkflow(wf)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {actionError && <p role="alert" className="mt-4 text-sm text-destructive">{actionError}</p>}
      </main>
      <TemplateGalleryDialog open={templatesOpen} onOpenChange={setTemplatesOpen} onSelect={(template) => void handleCreateFromTemplate(template)} busy={creatingTemplate} />
      <Dialog open={Boolean(deletingWorkflow)} onOpenChange={(open) => { if (!open && !deleting) setDeletingWorkflow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workflow?</DialogTitle>
            <DialogDescription>
              This permanently deletes “{deletingWorkflow?.name}”, including its published versions and execution history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setDeletingWorkflow(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void handleDelete()}>{deleting ? 'Deleting…' : 'Delete workflow'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
