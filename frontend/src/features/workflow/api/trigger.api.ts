import { apiClient } from '../../../shared/api/http-client';
import type { WorkflowTrigger } from '../types/trigger.types';

export const triggerApi = {
  list: async (workflowId: string): Promise<WorkflowTrigger[]> => {
    const res = await apiClient.get<{ data: WorkflowTrigger[] }>(
      `/api/workflows/${workflowId}/triggers`,
    );
    return res.data.data;
  },
};
