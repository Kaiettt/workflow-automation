import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { executionService } from '../services/execution.service';
import type { ExecutionResult } from '../types/execution.types';
import { mergeExecutionSnapshot } from '../utils/execution-cache.util';
import { isTerminalExecutionState } from '../utils/execution-status.util';

export function useExecution(
  executionId: string | null,
  pollIntervalMs = 1000,
  pollingEnabled = true,
) {
  return useQuery<ExecutionResult>({
    queryKey: ['execution', executionId],
    queryFn: async ({ client }) => {
      if (!executionId) throw new Error('Execution ID is required');
      const snapshot = await executionService.getExecution(executionId);
      return mergeExecutionSnapshot(
        client.getQueryData<ExecutionResult>(['execution', executionId]),
        snapshot,
      );
    },
    enabled: Boolean(executionId),
    refetchInterval: (query) => {
      if (!pollingEnabled) return false;

      if (
        isAxiosError(query.state.error) &&
        (query.state.error.response?.status === 403 ||
          query.state.error.response?.status === 404)
      ) {
        return false;
      }

      return query.state.data &&
        isTerminalExecutionState('', query.state.data.status)
        ? false
        : pollIntervalMs;
    },
  });
}