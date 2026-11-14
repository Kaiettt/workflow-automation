import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Activity, CheckCircle2, XCircle, Loader2, Copy, Check } from 'lucide-react';
import type { ExecutionResult } from '../../types/execution.types';

interface ExecutionResultStatsProps {
  executionResult: ExecutionResult;
}

export const ExecutionResultStats: React.FC<ExecutionResultStatsProps> = ({
  executionResult,
}) => {
  const [copiedId, setCopiedId] = useState(false);

  const copyExecutionId = (id: string) => {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="size-5 text-primary" />
        <h2 className="text-lg font-bold">Execution result</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Status Badge Card */}
        <Card className="p-4 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground font-medium">Overall status</span>
          <div className="mt-2 flex items-center gap-2">
            {executionResult.status === 'SUCCESS' ? (
              <>
                <CheckCircle2 className="size-5 text-emerald-500" />
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  SUCCESS
                </span>
              </>
            ) : executionResult.status === 'FAILED' ? (
              <>
                <XCircle className="size-5 text-destructive" />
                <span className="text-base font-bold text-destructive font-mono">
                  {executionResult.status}
                </span>
              </>
            ) : (
              <>
                <Loader2 className="size-5 animate-spin text-primary" />
                <span className="text-base font-bold font-mono">
                  {executionResult.status}
                </span>
              </>
            )}
          </div>
        </Card>

        {/* Duration Card */}
        <Card className="p-4 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground font-medium">Execution duration</span>
          <div className="mt-2 text-xl font-bold font-mono text-foreground">
            {executionResult.durationMs == null
              ? 'In progress'
              : `${executionResult.durationMs} ms`}
          </div>
        </Card>

        {/* Started At Card */}
        <Card className="p-4 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground font-medium">Started</span>
          <div className="mt-2 text-sm font-semibold font-mono text-foreground">
            {executionResult.startedAt
              ? new Date(executionResult.startedAt).toLocaleTimeString('en-US')
              : 'Waiting in queue'}
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
              title="Copy execution ID"
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
  );
};

