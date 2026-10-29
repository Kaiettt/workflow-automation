import { triggerApi } from '../api/trigger.api';
import type { WorkflowTrigger } from '../types/trigger.types';

export const triggerService = {
  list: (workflowId: string): Promise<WorkflowTrigger[]> => triggerApi.list(workflowId),

  // Listener of a node, if the node belongs to the published version.
  findForNode: (triggers: WorkflowTrigger[] | undefined, nodeId: string) =>
    triggers?.find((trigger) => trigger.nodeId === nodeId),
};
