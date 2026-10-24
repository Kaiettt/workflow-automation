import { useMemo } from 'react';
import type { Node } from '@xyflow/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, ChevronRight, XCircle } from 'lucide-react';
import type { WorkflowValidationIssue } from '../models/workflow-validation.model';

export interface PublishValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message?: string;
  issues: WorkflowValidationIssue[];
  nodes: Node[];
  onSelectNode: (nodeId: string) => void;
}

import {
  formatHumanFriendlyIssue,
  groupValidationIssues,
} from '../utils/workflow-validation.util';
export type { GroupedNodeErrors } from '../utils/workflow-validation.util';

export function PublishValidationDialog({
  open,
  onOpenChange,
  message,
  issues,
  nodes,
  onSelectNode,
}: PublishValidationDialogProps) {
  const groupedErrors = useMemo(
    () => groupValidationIssues(issues, nodes, message),
    [issues, nodes, message],
  );

  const totalErrors = issues.length > 0 ? issues.length : (message ? 1 : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="publish-validation-dialog"
        role="alert"
        aria-label="Workflow Validation Issues"
        className="max-w-md sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-200/90 dark:bg-zinc-950 dark:border-zinc-800"
      >
        {/* Header - Clean neutral styling with subtle red alert indicator */}
        <DialogHeader className="p-5 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 mt-0.5">
              <AlertCircle className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Workflow Issues Found
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="border-rose-200 bg-rose-50/80 text-[11px] font-semibold text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-400"
                >
                  {totalErrors} {totalErrors === 1 ? 'error' : 'errors'}
                </Badge>
              </div>
              <DialogDescription className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Please resolve the following required fields or connections before publishing.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Grouped Cards List - Neutral cards with red indicators */}
        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-3">
          {groupedErrors.map((group) => {
            const isClickable = Boolean(group.nodeId);

            return (
              <Card
                key={group.nodeId ?? 'workflow'}
                onClick={() => {
                  if (group.nodeId) {
                    onSelectNode(group.nodeId);
                  }
                }}
                className={`p-3.5 border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 transition-all ${
                  isClickable
                    ? 'cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs group'
                    : ''
                }`}
              >
                {/* Node Group Header - No internal ID exposed */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <XCircle className="size-4 text-rose-500 shrink-0" />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-primary transition-colors">
                      {group.nodeName}
                    </span>
                    <span className="text-xs font-normal text-zinc-400">
                      ({group.issues.length} {group.issues.length === 1 ? 'error' : 'errors'})
                    </span>
                  </div>

                  {isClickable && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Focus node ${group.nodeId ?? group.nodeName}`}
                      className="h-6 px-1.5 text-xs text-zinc-400 group-hover:text-primary font-medium flex items-center gap-0.5"
                    >
                      <span>Fix</span>
                      <ChevronRight className="size-3" />
                    </Button>
                  )}
                </div>

                {/* Friendly Error Bullet List */}
                <ul className="mt-2.5 space-y-1.5 pl-6 text-xs text-zinc-600 dark:text-zinc-400">
                  {group.issues.map((issue, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span>{formatHumanFriendlyIssue(issue)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 flex items-center justify-between">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Click any node above to zoom and open its properties panel.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8 px-3"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
