import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useExecution } from './useExecution';
import { useExecutionHistory } from './useExecutionHistory';
import { useExecutionStream } from './useExecutionStream';
import { useStartExecution } from './useStartExecution';
import { applyExecutionStreamEvent } from '../utils/execution-cache.util';
import type { ExecutionResult, ExecutionHistoryItem } from '../types/execution.types';

export interface UseExecutionMonitorOptions {
  workflowId: string;
  versionId: string;
  onBeforeRun?: () => void;
}

export interface UseExecutionMonitorReturn {
  selectedExecutionId: string | null;
  selectExecution: (executionId: string) => void;
  executionResult: ExecutionResult | undefined;
  executionError: boolean;
  executionHistory: ExecutionHistoryItem[] | undefined;
  streamState: 'connected' | 'reconnecting' | 'disconnected';
  isPending: boolean;
  handleRun: () => void;
}

export function useExecutionMonitor({
  workflowId,
  versionId,
  onBeforeRun,
}: UseExecutionMonitorOptions): UseExecutionMonitorReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedExecutionId = searchParams.get('execution');
  const queryClient = useQueryClient();
  const [streamState, setStreamState] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');

  const { data: executionResult, isError: executionError } = useExecution(
    selectedExecutionId,
    1000,
    streamState !== 'connected',
  );

  useExecutionStream(
    selectedExecutionId,
    (event) => {
      if (!selectedExecutionId) return;

      queryClient.setQueryData<ExecutionResult>(
        ['execution', selectedExecutionId],
        (current) => applyExecutionStreamEvent(current, event),
      );
    },
    setStreamState,
  );

  const { data: historyPage } = useExecutionHistory(workflowId, versionId);

  const selectExecution = useCallback(
    (executionId: string) => {
      setSearchParams(
        (current) => {
          current.set('execution', executionId);
          return current;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const startExecutionMutation = useStartExecution({
    workflowId,
    workflowVersionId: versionId,
    onSuccess: (data) => {
      selectExecution(data.id);
    },
    onError: (err: unknown) => {
      console.error('Run execution error:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'An error occurred while executing the workflow.';
      alert(`Execution error: ${message}`);
    },
  });

  const handleRun = useCallback(() => {
    if (!versionId || startExecutionMutation.isPending) return;
    onBeforeRun?.();
    startExecutionMutation.mutate({
      workflow_version_id: versionId,
      idempotency_key: crypto.randomUUID(),
    });
  }, [versionId, startExecutionMutation, onBeforeRun]);

  return {
    selectedExecutionId,
    selectExecution,
    executionResult,
    executionError,
    executionHistory: historyPage?.items,
    streamState,
    isPending: startExecutionMutation.isPending,
    handleRun,
  };
}

