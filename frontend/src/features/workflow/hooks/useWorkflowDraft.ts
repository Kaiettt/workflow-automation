import { useQuery } from '@tanstack/react-query';
import type { Node, Edge } from '@xyflow/react';
import { workflowService } from '../services/workflow.service';
import { workflowApi } from '../api/workflow.api';
import type { NodeTypeDefinition } from '../models/workflow.model';
import type { WorkflowValidationIssue } from '../models/workflow-validation.model';

export interface WorkflowDraft {
  definition?: {
    nodes?: Node[];
    edges?: Edge[];
    viewport?: { x: number; y: number; zoom: number };
  };
  validationErrors?: {
    message?: string;
    issues?: WorkflowValidationIssue[];
  } | null;
}

export const draftKeys = {
  all: ['workflow-draft'] as const,
  detail: (id: string) => [...draftKeys.all, id] as const,
  nodeTypes: ['node-types'] as const,
};

export function useWorkflowDraft(workflowId: string) {
  return useQuery<WorkflowDraft>({
    queryKey: draftKeys.detail(workflowId),
    queryFn: () => workflowService.getDraft(workflowId) as Promise<WorkflowDraft>,
    enabled: Boolean(workflowId),
  });
}

export function useNodeMetadata(keys: string[]) {
  return useQuery({
    queryKey: ['node-metadata', keys],
    queryFn: async ({ signal }) => {
      const chunks: string[][] = [];
      for (let i = 0; i < keys.length; i += 100) chunks.push(keys.slice(i, i + 100));
      return (await Promise.all(chunks.map(chunk => workflowApi.getNodeMetadata(chunk, signal)))).flat();
    },
    enabled: keys.length > 0,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}
export function useNodeTypes() {
  return useQuery<NodeTypeDefinition[]>({
    queryKey: draftKeys.nodeTypes,
    queryFn: () => workflowService.getNodeTypes(),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

