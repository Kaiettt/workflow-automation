import { AxiosError } from 'axios';
import { workflowApi } from '../api/workflow.api';

export const workflowService = {
  async createWorkflow(): Promise<string> {
    try {
      const data = await workflowApi.createWorkflow();
      return data.id;
    } catch (error: unknown) {
      throw new Error('Failed to create workflow', { cause: error });
    }
  },

  async getDraft(id: string): Promise<unknown> {
    try {
      return await workflowApi.getDraft(id);
    } catch (error: unknown) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        return {
          definition: {
            nodes: [],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
          },
        };
      }
      throw new Error('Failed to get draft', { cause: error });
    }
  },

  async saveDraft(id: string, definition: unknown): Promise<void> {
    try {
      await workflowApi.saveDraft(id, definition);
    } catch (error: unknown) {
      throw new Error('Failed to save draft', { cause: error });
    }
  },

  async publishWorkflow(id: string): Promise<void> {
    try {
      await workflowApi.publishWorkflow(id);
    } catch (error: unknown) {
      if (
        error instanceof AxiosError &&
        error.response?.data &&
        typeof error.response.data === 'object' &&
        'message' in error.response.data
      ) {
        throw new Error(String(error.response.data.message), { cause: error });
      }
      throw new Error('Failed to publish workflow', { cause: error });
    }
  },
};
