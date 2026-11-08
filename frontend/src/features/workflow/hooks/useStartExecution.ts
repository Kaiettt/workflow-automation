import { useMutation, useQueryClient } from '@tanstack/react-query';
import { executionService } from '../services/execution.service';
import type { ExecutionResult, StartExecutionInput } from '../types/execution.types';

export function useStartExecution(options?: {
  workflowId?: string;
  workflowVersionId?: string;
  onSuccess?: (data: ExecutionResult) => void;
  onError?: (error: unknown) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<ExecutionResult, unknown, StartExecutionInput>({
    mutationFn: (input) => executionService.startExecution(input),
    onSuccess: (data) => {
      if (options?.workflowId && options.workflowVersionId) {
        void queryClient.invalidateQueries({
          queryKey: [
            'execution-history',
            options.workflowId,
            options.workflowVersionId,
          ],
        });
      }
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
}
