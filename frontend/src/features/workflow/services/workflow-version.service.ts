import { workflowVersionApi } from '../api/workflow-version.api';
import type {
  WorkflowVersionSummary,
  WorkflowVersionDetail,
  DraftStatusResponse,
  RestoreVersionRequest,
  RestoreVersionResponse,
} from '../types/version.types';

export const workflowVersionService = {
  getVersions: async (workflowId: string): Promise<WorkflowVersionSummary[]> => {
    return workflowVersionApi.getVersions(workflowId);
  },

  getVersion: async (
    workflowId: string,
    versionId: string,
  ): Promise<WorkflowVersionDetail> => {
    return workflowVersionApi.getVersion(workflowId, versionId);
  },

  getDraftStatus: async (workflowId: string): Promise<DraftStatusResponse> => {
    return workflowVersionApi.getDraftStatus(workflowId);
  },

  restoreVersion: async (
    workflowId: string,
    versionId: string,
    request: RestoreVersionRequest,
  ): Promise<RestoreVersionResponse> => {
    return workflowVersionApi.restoreVersion(workflowId, versionId, request);
  },
};
