import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import {
  Webhook,
  GitFork,
  Database,
  Mail,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  Check,
  X,
} from 'lucide-react';

export interface ExecutionCanvasNodeData extends Record<string, unknown> {
  label: string;
  category: string;
  iconType: 'webhook' | 'filter' | 'database' | 'mail' | 'action' | 'ai';
  detail: string;
  status: 'idle' | 'running' | 'success' | 'failed' | 'skipped';
  hasTarget: boolean;
  hasSource: boolean;
  outputSummary?: string;
  errorMessage?: string;
  durationMs?: number;
}

export const ExecutionCanvasNode: React.FC<NodeProps<Node<ExecutionCanvasNodeData>>> = ({
  data,
}) => {
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
      case 'ai':
        return <Sparkles className="size-4 text-purple-500" />;
      case 'action':
      default:
        return <Sparkles className="size-4 text-primary" />;
    }
  };

  const getStatusBorder = () => {
    switch (data.status) {
      case 'running':
        return 'border-indigo-500 ring-2 ring-indigo-500/30 shadow-indigo-500/20';
      case 'success':
        return 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-emerald-500/10';
      case 'failed':
        return 'border-rose-500 ring-2 ring-rose-500/20 shadow-rose-500/10';
      case 'skipped':
        return 'border-dashed border-border opacity-60';
      case 'idle':
      default:
        return 'border-border hover:border-border/80';
    }
  };

  return (
    <div
      className={`relative min-w-[200px] rounded-xl border bg-card p-3 shadow-md transition-all duration-300 ${getStatusBorder()}`}
      data-testid={`execution-node-${data.label}`}
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
            <Loader2 className="size-3 text-indigo-500 animate-spin ml-1 shrink-0" aria-label="Running" />
          )}
          {data.status === 'success' && (
            <CheckCircle2 className="size-3.5 text-emerald-500 ml-1 shrink-0" aria-label="Success" />
          )}
          {data.status === 'failed' && (
            <XCircle className="size-3.5 text-rose-500 ml-1 shrink-0" aria-label="Failed" />
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

