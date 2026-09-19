import { useAuthStore } from '../../auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const getHeaders = (extraHeaders?: Record<string, string>): Record<string, string> => {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
};

export const workflowApi = {
  createWorkflow: async (): Promise<Response> => {
    const user = useAuthStore.getState().user;
    const body: { name: string; ownerId?: string } = {
      name: 'New Workflow',
    };
    if (user?.id) {
      body.ownerId = user.id;
    }

    return fetch(`${API_URL}/workflows`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
  },

  getDraft: async (id: string): Promise<Response> => {
    return fetch(`${API_URL}/workflows/${id}/draft`, {
      headers: getHeaders(),
    });
  },

  saveDraft: async (id: string, definition: unknown): Promise<Response> => {
    return fetch(`${API_URL}/workflows/${id}/draft`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ definition }),
    });
  },

  publishWorkflow: async (id: string): Promise<Response> => {
    return fetch(`${API_URL}/workflows/${id}/versions`, {
      method: 'POST',
      headers: getHeaders(),
    });
  },
};
