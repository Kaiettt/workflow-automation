import { apiClient } from '../../../shared/api/http-client';
import type { ExecutionResult, StartExecutionRequest } from '../types/execution.types';

export const executionApi = {
  startExecution: async (
    request: StartExecutionRequest,
  ): Promise<ExecutionResult> => {
    const res = await apiClient.post<{ data: ExecutionResult }>(
      '/api/executions',
      request,
    );
    return res.data.data;
  },
};
