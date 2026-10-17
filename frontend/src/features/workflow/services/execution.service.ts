import { AxiosError } from 'axios';
import { executionApi } from '../api/execution.api';
import type { ExecutionResult, StartExecutionRequest } from '../types/execution.types';

export const executionService = {
  startExecution: async (
    request: StartExecutionRequest,
  ): Promise<ExecutionResult> => {
    try {
      return await executionApi.startExecution(request);
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
};
