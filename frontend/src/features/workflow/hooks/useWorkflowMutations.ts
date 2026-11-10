import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowService } from '../services/workflow.service';
import { workflowKeys } from './useWorkflows';
import { versionKeys } from './useWorkflowVersions';
import { triggerKeys } from './useWorkflowTriggers';
import { draftKeys } from './useWorkflowDraft';
import type { WorkflowTemplate } from '../templates/catalog';
import type { PublishResult } from '../types/workflow.types';

export function useCreateWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name?: string) => workflowService.createWorkflow(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workflowKeys.all });
    },
  });
}

export function useCreateWorkflowFromTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (template: WorkflowTemplate) => {
      const workflowId = await workflowService.createWorkflow(template.title);
      await workflowService.saveDraft(workflowId, {
        nodes: structuredClone(template.nodes),
        edges: structuredClone(template.edges),
        viewport: { x: 0, y: 0, zoom: 1 },
      });
      return workflowId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workflowKeys.all });
    },
  });
}

export function useRenameWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      workflowService.renameWorkflow(id, name),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: workflowKeys.all });
      void queryClient.invalidateQueries({ queryKey: draftKeys.detail(id) });
    },
  });
}

export function useDeleteWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workflowService.deleteWorkflow(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workflowKeys.all });
    },
  });
}

export function useSaveDraftMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, definition }: { id: string; definition: unknown }) =>
      workflowService.saveDraft(id, definition),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: draftKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: versionKeys.draftStatus(id) });
    },
  });
}

export function usePublishWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation<PublishResult, unknown, string>({
    mutationFn: (id: string) => workflowService.publishWorkflow(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: workflowKeys.all });
      void queryClient.invalidateQueries({ queryKey: draftKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: versionKeys.all });
      void queryClient.invalidateQueries({ queryKey: triggerKeys.activation(id) });
    },
  });
}

export function useWorkflowMutations() {
  const createWorkflowMutation = useCreateWorkflowMutation();
  const createFromTemplateMutation = useCreateWorkflowFromTemplateMutation();
  const renameWorkflowMutation = useRenameWorkflowMutation();
  const deleteWorkflowMutation = useDeleteWorkflowMutation();
  const saveDraftMutation = useSaveDraftMutation();
  const publishWorkflowMutation = usePublishWorkflowMutation();

  return {
    createWorkflowMutation,
    createFromTemplateMutation,
    renameWorkflowMutation,
    deleteWorkflowMutation,
    saveDraftMutation,
    publishWorkflowMutation,
  };
}

