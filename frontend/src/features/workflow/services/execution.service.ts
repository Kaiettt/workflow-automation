import { executionApi } from '../api/execution.api';
import type { ExecutionResult, StartExecutionRequest } from '../types/execution.types';

export const executionService = {
  startExecution: async (
    request: StartExecutionRequest,
  ): Promise<ExecutionResult> => {
    return executionApi.startExecution(request);
  },
};
