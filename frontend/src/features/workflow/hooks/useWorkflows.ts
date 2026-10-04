import { useQuery } from '@tanstack/react-query';
import { workflowService } from '../services/workflow.service';
import type { WorkflowSummary } from '../types/workflow.types';

export const workflowKeys = {
  all: ['workflows'] as const,
  list: () => [...workflowKeys.all, 'list'] as const,
};

export function useWorkflows() {
  return useQuery<WorkflowSummary[]>({
    queryKey: workflowKeys.list(),
    queryFn: () => workflowService.getWorkflows(),
  });
}
