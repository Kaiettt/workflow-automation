import { workflowApi } from '../api/workflow.api';

export const workflowService = {
  async createWorkflow(): Promise<string> {
    const response = await workflowApi.createWorkflow();

    if (!response.ok) {
      throw new Error('Failed to create workflow');
    }
    console.log("good")
    const responseData = await response.json();
    return responseData.data.id;
  },

  async getDraft(id: string): Promise<unknown> {
    const response = await workflowApi.getDraft(id);

    if (!response.ok) {
      if (response.status === 404) {
        return { definition: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } } };
      }
      throw new Error('Failed to get draft');
    }

    const responseData = await response.json();
    return responseData.data;
  },

  async saveDraft(id: string, definition: unknown): Promise<void> {
    const response = await workflowApi.saveDraft(id, definition);

    if (!response.ok) {
      throw new Error('Failed to save draft');
    }
  },
};
