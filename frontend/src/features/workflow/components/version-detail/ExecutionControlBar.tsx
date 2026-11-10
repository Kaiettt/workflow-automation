import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Play, RotateCcw, Loader2 } from 'lucide-react';
import { EventTriggerInfo } from '../EventTriggerInfo';

interface ExecutionControlBarProps {
  workflowId: string;
  versionId: string;
  versionNumber: number | string;
  publishedAt: string;
  streamState: 'connected' | 'reconnecting' | 'disconnected';
  hasSelectedExecution: boolean;
  isPending: boolean;
  onRun: () => void;
  eventTriggerNode?: { id: string; data?: { name?: string; key?: string } };
}

export const ExecutionControlBar: React.FC<ExecutionControlBarProps> = ({
  workflowId,
  versionId,
  versionNumber,
  publishedAt,
  streamState,
  hasSelectedExecution,
  isPending,
  onRun,
  eventTriggerNode,
}) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Badge variant="default" className="text-sm font-mono px-3 py-1 font-bold">
            Phiên bản v{versionNumber}
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="size-3.5" />
            Xuất bản: {new Date(publishedAt).toLocaleString('vi-VN')}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Chi tiết Phiên bản &amp; Kích hoạt Run UI
        </h1>
        <p className="text-sm text-muted-foreground">
          Workflow ID: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{workflowId}</code> • Version ID: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{versionId}</code>
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Badge
          variant={
            streamState === 'connected'
              ? 'default'
              : streamState === 'reconnecting'
                ? 'secondary'
                : 'outline'
          }
          className="text-[10px] uppercase tracking-wide"
        >
          {streamState === 'connected'
            ? 'Connected'
            : streamState === 'reconnecting'
              ? 'Reconnecting'
              : 'Disconnected'}
        </Badge>
        {eventTriggerNode ? (
          <EventTriggerInfo
            workflowId={workflowId}
            versionId={versionId}
            triggerName={String(eventTriggerNode.data?.name ?? eventTriggerNode.id)}
          />
        ) : (
          <Button
            size="lg"
            onClick={onRun}
            disabled={isPending}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 font-semibold px-6 shadow-md transition-all"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : hasSelectedExecution ? (
              <RotateCcw className="size-4" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
            <span>
              {isPending
                ? 'Đang gửi yêu cầu...'
                : hasSelectedExecution
                  ? 'Chạy lại phiên bản (Rerun)'
                  : 'Kích hoạt chạy ngay (Run)'}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
};

