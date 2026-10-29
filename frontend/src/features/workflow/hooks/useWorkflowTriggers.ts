import { useQuery } from '@tanstack/react-query';
import { triggerService } from '../services/trigger.service';
import type { WorkflowTrigger } from '../types/trigger.types';

export const triggerKeys = {
  all: ['workflow-triggers'] as const,
  list: (workflowId: string) => [...triggerKeys.all, workflowId] as const,
};

// Listeners are stored right after a publish; with `waitForNodeId` the query
// keeps checking until that node has one, so a fresh URL shows up by itself.
export function useWorkflowTriggers(workflowId: string | undefined, waitForNodeId?: string) {
  return useQuery<WorkflowTrigger[]>({
    queryKey: triggerKeys.list(workflowId ?? ''),
    queryFn: () => triggerService.list(workflowId as string),
    enabled: !!workflowId,
    refetchInterval: (query) =>
      waitForNodeId && !triggerService.findForNode(query.state.data, waitForNodeId)
        ? 5000
        : false,
  });
}
