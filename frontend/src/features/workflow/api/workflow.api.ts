import { apiClient } from '../../../shared/api/http-client';
import { useAuthStore } from '../../auth';
import type { NodeTypeDefinition } from '../models/workflow.model';
import type { PublishResult } from '../types/workflow.types';


export const workflowApi = {
  createWorkflow: async (): Promise<{ id: string }> => {
    const user = useAuthStore.getState().user;
    const body: { name: string; ownerId?: string } = {
      name: 'New Workflow',
    };
    if (user?.id) {
      body.ownerId = user.id;
    }

    const res = await apiClient.post<{ data: { id: string } }>(
      '/api/workflows',
      body,
    );
    return res.data.data;
  },

  getWorkflows: async (): Promise<import('../types/workflow.types').WorkflowSummary[]> => {
    const res = await apiClient.get<{ data: import('../types/workflow.types').WorkflowSummary[] }>(
      '/api/workflows',
    );
    return res.data.data;
  },

  getDraft: async (id: string): Promise<unknown> => {
    const res = await apiClient.get<{ data: unknown }>(
      `/api/workflows/${id}/draft`,
    );
    return res.data.data;
  },

  saveDraft: async (id: string, definition: unknown): Promise<void> => {
    await apiClient.put(`/api/workflows/${id}/draft`, { definition });
  },

  publishWorkflow: async (id: string): Promise<PublishResult> => {
    const res = await apiClient.post<{ data: PublishResult }>(`/api/workflows/${id}/versions`);
    return res.data.data;
  },

  getNodeTypes: async (): Promise<NodeTypeDefinition[]> => {
    const res = await apiClient.get<{ data: NodeTypeDefinition[] }>(
      '/api/node-types',
    );
    return res.data.data;
  },
};
