import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { executionService } from '../services/execution.service';
import type { ExecutionResult } from '../types/execution.types';

const TERMINAL_STATUSES = new Set(['SUCCESS', 'FAILED', 'CANCELLED']);

export function useExecution(executionId: string | null, pollIntervalMs = 1000) {
  return useQuery<ExecutionResult>({
    queryKey: ['execution', executionId],
    queryFn: () => {
      if (!executionId) throw new Error('Execution ID is required');
      return executionService.getExecution(executionId);
    },
    enabled: Boolean(executionId),
    refetchInterval: (query) => {
      if (
        isAxiosError(query.state.error) &&
        (query.state.error.response?.status === 403 ||
          query.state.error.response?.status === 404)
      ) {
        return false;
      }

      return query.state.data && TERMINAL_STATUSES.has(query.state.data.status)
        ? false
        : pollIntervalMs;
    },
  });
}