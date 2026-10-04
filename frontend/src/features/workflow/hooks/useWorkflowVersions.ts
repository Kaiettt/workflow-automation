import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowVersionService } from '../services/workflow-version.service';
import type {
  RestoreVersionRequest,
  RestoreVersionResponse,
  WorkflowVersionSummary,
  DraftStatusResponse,
} from '../types/version.types';

export const versionKeys = {
  all: ['workflow-versions'] as const,
  list: (workflowId: string) => [...versionKeys.all, 'list', workflowId] as const,
  detail: (workflowId: string, versionId: string) =>
    [...versionKeys.all, 'detail', workflowId, versionId] as const,
  draftStatus: (workflowId: string) => [...versionKeys.all, 'draft-status', workflowId] as const,
};

export function useWorkflowVersions(workflowId: string) {
  return useQuery<WorkflowVersionSummary[]>({
    queryKey: versionKeys.list(workflowId),
    queryFn: () => workflowVersionService.getVersions(workflowId),
    enabled: !!workflowId,
  });
}

export function useWorkflowVersion(workflowId: string, versionId: string) {
  return useQuery<import('../types/version.types').WorkflowVersionDetail>({
    queryKey: versionKeys.detail(workflowId, versionId),
    queryFn: () => workflowVersionService.getVersion(workflowId, versionId),
    enabled: !!workflowId && !!versionId,
  });
}

export function useDraftStatus(workflowId: string) {
  return useQuery<DraftStatusResponse>({
    queryKey: versionKeys.draftStatus(workflowId),
    queryFn: () => workflowVersionService.getDraftStatus(workflowId),
    enabled: !!workflowId,
  });
}

export function useRestoreVersion(
  workflowId: string,
  options?: {
    onSuccess?: (data: RestoreVersionResponse) => void;
    onError?: (error: unknown) => void;
  },
) {
  const queryClient = useQueryClient();

  return useMutation<
    RestoreVersionResponse,
    unknown,
    { versionId: string; request: RestoreVersionRequest }
  >({
    mutationFn: ({ versionId, request }) =>
      workflowVersionService.restoreVersion(workflowId, versionId, request),
    onSuccess: (data) => {
      // Invalidate relevant queries
      void queryClient.invalidateQueries({ queryKey: versionKeys.list(workflowId) });
      void queryClient.invalidateQueries({ queryKey: versionKeys.draftStatus(workflowId) });
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
}
