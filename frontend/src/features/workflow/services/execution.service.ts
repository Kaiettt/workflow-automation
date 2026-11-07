import { AxiosError } from 'axios';
import { executionApi } from '../api/execution.api';
import type {
  ExecutionHistoryPage,
  ExecutionResult,
  ListExecutionsRequest,
  StartExecutionInput,
} from '../types/execution.types';

export const executionService = {
  startExecution: async (
    input: StartExecutionInput,
  ): Promise<ExecutionResult> => {
    try {
      const { idempotency_key, ...request } = input;
      return await executionApi.startExecution(request, idempotency_key);
    } catch (error: unknown) {
      // The server explains why it refused (e.g. the nodes are not one connected chain).
      if (
        error instanceof AxiosError &&
        error.response?.data &&
        typeof error.response.data === 'object' &&
        'message' in error.response.data
      ) {
        throw new Error(String(error.response.data.message), { cause: error });
      }
      throw error;
    }
  },

  getExecution: (executionId: string): Promise<ExecutionResult> =>
    executionApi.getExecution(executionId),

  listExecutions: (
    request: ListExecutionsRequest,
  ): Promise<ExecutionHistoryPage> => executionApi.listExecutions(request),
};
