import { apiClient } from '../../../shared/api/http-client';
import { useAuthStore } from '../../auth';

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
      '/workflows',
      body,
    );
    return res.data.data;
  },

  getDraft: async (id: string): Promise<unknown> => {
    const res = await apiClient.get<{ data: unknown }>(
      `/workflows/${id}/draft`,
    );
    return res.data.data;
  },

  saveDraft: async (id: string, definition: unknown): Promise<void> => {
    await apiClient.put(`/workflows/${id}/draft`, { definition });
  },

  publishWorkflow: async (id: string): Promise<void> => {
    await apiClient.post(`/workflows/${id}/versions`);
  },
};
