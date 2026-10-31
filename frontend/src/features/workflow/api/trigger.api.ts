import { apiClient } from '../../../shared/api/http-client';
import type {
  ActivationState,
  NodeOption,
  NodeWebhook,
  OAuth2Start,
  TestListen,
} from '../types/trigger.types';

export const triggerApi = {
  activation: async (workflowId: string): Promise<ActivationState> => {
    const res = await apiClient.get<{ data: ActivationState }>(
      `/api/workflows/${workflowId}/activation`,
    );
    return res.data.data;
  },

  setActive: async (workflowId: string, active: boolean): Promise<ActivationState> => {
    const res = await apiClient.post<{ data: ActivationState }>(
      `/api/workflows/${workflowId}/${active ? 'activate' : 'deactivate'}`,
    );
    return res.data.data;
  },

  webhooks: async (workflowId: string): Promise<NodeWebhook[]> => {
    const res = await apiClient.get<{ data: NodeWebhook[] }>(
      `/api/workflows/${workflowId}/webhooks`,
    );
    return res.data.data;
  },

  startTestListen: async (workflowId: string, nodeId: string): Promise<TestListen> => {
    const res = await apiClient.post<{ data: TestListen }>(
      `/api/workflows/${workflowId}/nodes/${encodeURIComponent(nodeId)}/test-listen`,
    );
    return res.data.data;
  },

  testListen: async (listenId: string): Promise<TestListen> => {
    const res = await apiClient.get<{ data: TestListen }>(`/api/test-events/${listenId}`);
    return res.data.data;
  },

  stopTestListen: async (listenId: string): Promise<void> => {
    await apiClient.delete(`/api/test-events/${listenId}`);
  },

  loadOptions: async (
    nodeKey: string,
    property: string,
    credentialId: string | undefined,
  ): Promise<NodeOption[]> => {
    const res = await apiClient.post<{ data: NodeOption[] }>(
      `/api/node-types/${encodeURIComponent(nodeKey)}/options/${encodeURIComponent(property)}`,
      { credentialId },
    );
    return res.data.data;
  },

  // Sign-in URL of an OAuth2 credential, opened in a pop-up.
  oauth2Start: async (credentialId: string): Promise<OAuth2Start> => {
    const res = await apiClient.get<OAuth2Start>('/api/oauth2/auth', {
      params: { credentialId },
    });
    return res.data;
  },

  oauth2Complete: async (state: string, code: string): Promise<string> => {
    const res = await apiClient.post<{ data: { credentialId: string } }>(
      '/api/oauth2/complete',
      { state, code },
    );
    return res.data.data.credentialId;
  },
};
