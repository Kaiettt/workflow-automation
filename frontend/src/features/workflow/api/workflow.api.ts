const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export const workflowApi = {
  createWorkflow: async (): Promise<Response> => {
    return fetch(`${API_URL}/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'New Workflow', ownerId: '9f16ce27-4570-4044-89f2-5790b30a5544' }),
    });
  },

  getDraft: async (id: string): Promise<Response> => {
    return fetch(`${API_URL}/workflows/${id}/draft`);
  },

  saveDraft: async (id: string, definition: unknown): Promise<Response> => {
    return fetch(`${API_URL}/workflows/${id}/draft`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ definition }),
    });
  },

  publishWorkflow: async (id: string): Promise<Response> => {
    return fetch(`${API_URL}/workflows/${id}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
};
