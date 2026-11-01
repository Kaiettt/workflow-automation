import { ExecutionStatus, TriggerType } from '../constants/execution.constants';

export interface WorkflowVersionForExecution {
  id: string;
  workflowId: string;
  definition: unknown;
  workflowOwnerId: string;
}

export interface ExecutionRecord {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  triggerType: TriggerType;
  // null when nobody pressed Run (webhook).
  triggeredById: string | null;
  // QUEUED for a background run until the queue picks it up, else RUNNING.
  status: ExecutionStatus.QUEUED | ExecutionStatus.RUNNING;
  startedAt: Date;
  // Normalized trigger payload, kept for debugging.
  context?: unknown;
}

export interface NodeLogRecord {
  nodeId: string;
  nodeKey: string;
  // SKIPPED: no incoming edge was activated, so the node did not run.
  status: Exclude<ExecutionStatus, ExecutionStatus.QUEUED> | 'SKIPPED';
  input: unknown;
  output: unknown;
  errorMessage?: string;
  startedAt: Date;
  finishedAt: Date;
}

export interface ResolvedCredential {
  connectorKey: string;
  secret: unknown;
}
