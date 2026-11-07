import { useQuery } from '@tanstack/react-query';
import { executionService } from '../services/execution.service';

export function useExecutionHistory(
  workflowId: string,
  workflowVersionId?: string,
) {
  return useQuery({
    queryKey: ['execution-history', workflowId, workflowVersionId],
    queryFn: () =>
      executionService.listExecutions({ workflowId, workflowVersionId }),
    enabled: Boolean(workflowId),
  });
}