import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  GitBranch,
  ArrowRight,
  Workflow as WorkflowIcon,
  Clock,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { WorkflowSummary } from '../../types/workflow.types';

interface WorkflowTableProps {
  workflows: WorkflowSummary[];
  editingId: string | null;
  editingName: string;
  savingName: boolean;
  deleting: boolean;
  onNavigateWorkflow: (id: string) => void;
  onNavigateVersions: (id: string) => void;
  onStartRename: (workflow: WorkflowSummary) => void;
  onChangeEditingName: (name: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onPromptDelete: (workflow: WorkflowSummary) => void;
}

export const WorkflowTable: React.FC<WorkflowTableProps> = ({
  workflows,
  editingId,
  editingName,
  savingName,
  deleting,
  onNavigateWorkflow,
  onNavigateVersions,
  onStartRename,
  onChangeEditingName,
  onSaveRename,
  onCancelRename,
  onPromptDelete,
}) => {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[300px]">Workflow name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Created</TableHead>
            <TableHead className="hidden sm:table-cell">Last updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
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
                        <Input
                          aria-label="Workflow name"
                          autoFocus
                          value={editingName}
                          onChange={(event) => onChangeEditingName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') onSaveRename();
                            if (event.key === 'Escape') onCancelRename();
                          }}
                          className="h-8 min-w-32"
                        />
                        <Button
                          size="sm"
                          className="h-8"
                          disabled={!editingName.trim() || savingName}
                          onClick={onSaveRename}
                        >
                          {savingName ? 'Saving…' : 'Save'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          disabled={savingName}
                          onClick={onCancelRename}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="text-left font-semibold text-foreground text-sm hover:underline"
                        onClick={() => onNavigateWorkflow(wf.id)}
                      >
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
                  <span>
                    {wf.createdAt
                      ? new Date(wf.createdAt).toLocaleDateString('en-US')
                      : '—'}
                  </span>
                </div>
              </TableCell>

              <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                <span>
                  {wf.updatedAt
                    ? new Date(wf.updatedAt).toLocaleString('en-US')
                    : '—'}
                </span>
              </TableCell>

              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => onNavigateVersions(wf.id)}
                  >
                    <GitBranch className="size-3 text-primary" />
                    <span>Versions</span>
                  </Button>

                  <Button
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => onNavigateWorkflow(wf.id)}
                  >
                    <span>Open designer</span>
                    <ArrowRight className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Rename ${wf.name}`}
                    title="Rename workflow"
                    disabled={savingName || deleting}
                    onClick={() => onStartRename(wf)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${wf.name}`}
                    title="Delete workflow"
                    className="text-destructive hover:text-destructive"
                    disabled={deleting}
                    onClick={() => onPromptDelete(wf)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

