import { apiClient } from '../../../shared/api/http-client';
import type {
  ExecutionHistoryPage,
  ExecutionResult,
  ListExecutionsRequest,
  StartExecutionRequest,
} from '../types/execution.types';

export const executionApi = {
  startExecution: async (
    request: StartExecutionRequest,
    idempotencyKey: string,
  ): Promise<ExecutionResult> => {
    const res = await apiClient.post<{ data: ExecutionResult }>(
      '/api/executions',
      request,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    return res.data.data;
  },

  getExecution: async (executionId: string): Promise<ExecutionResult> => {
    const res = await apiClient.get<{ data: ExecutionResult }>(
      `/api/executions/${executionId}`,
    );
    return res.data.data;
  },

  listExecutions: async (
    request: ListExecutionsRequest,
  ): Promise<ExecutionHistoryPage> => {
    const res = await apiClient.get<{ data: ExecutionHistoryPage }>(
      '/api/executions',
      {
        params: {
          workflow_id: request.workflowId,
          workflow_version_id: request.workflowVersionId,
          cursor: request.cursor,
          limit: request.limit,
        },
      },
    );
    return res.data.data;
  },
};
