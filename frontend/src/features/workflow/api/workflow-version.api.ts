import { apiClient } from '../../../shared/api/http-client';
import type {
  WorkflowVersionSummary,
  WorkflowVersionDetail,
  DraftStatusResponse,
  RestoreVersionRequest,
  RestoreVersionResponse,
} from '../types/version.types';

export const workflowVersionApi = {
  getVersions: async (workflowId: string): Promise<WorkflowVersionSummary[]> => {
    const res = await apiClient.get<{ data: WorkflowVersionSummary[] }>(
      `/api/workflows/${workflowId}/versions`,
    );
    return res.data.data;
  },

  getVersion: async (
    workflowId: string,
    versionId: string,
  ): Promise<WorkflowVersionDetail> => {
    const res = await apiClient.get<{ data: WorkflowVersionDetail }>(
      `/api/workflows/${workflowId}/versions/${versionId}`,
    );
    return res.data.data;
  },

  getDraftStatus: async (workflowId: string): Promise<DraftStatusResponse> => {
    const res = await apiClient.get<{ data: DraftStatusResponse }>(
      `/api/workflows/${workflowId}/draft/status`,
    );
    return res.data.data;
  },

  restoreVersion: async (
    workflowId: string,
    versionId: string,
    data: RestoreVersionRequest,
  ): Promise<RestoreVersionResponse> => {
    const res = await apiClient.post<{ data: RestoreVersionResponse }>(
      `/api/workflows/${workflowId}/versions/${versionId}/restore`,
      data,
    );
    return res.data.data;
  },
};
