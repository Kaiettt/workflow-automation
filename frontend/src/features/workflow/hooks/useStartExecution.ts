import { useMutation } from '@tanstack/react-query';
import { executionService } from '../services/execution.service';
import type { ExecutionResult, StartExecutionInput } from '../types/execution.types';

export function useStartExecution(options?: {
  onSuccess?: (data: ExecutionResult) => void;
  onError?: (error: unknown) => void;
}) {
  return useMutation<ExecutionResult, unknown, StartExecutionInput>({
    mutationFn: (input) => executionService.startExecution(input),
    onSuccess: (data) => {
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
}
