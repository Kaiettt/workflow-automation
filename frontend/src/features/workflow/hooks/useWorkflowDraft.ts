import { useQuery } from '@tanstack/react-query';
import type { Node, Edge } from '@xyflow/react';
import { workflowService } from '../services/workflow.service';
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

export function useNodeTypes() {
  return useQuery<NodeTypeDefinition[]>({
    queryKey: draftKeys.nodeTypes,
    queryFn: () => workflowService.getNodeTypes(),
    staleTime: 5 * 60 * 1000,
  });
}

