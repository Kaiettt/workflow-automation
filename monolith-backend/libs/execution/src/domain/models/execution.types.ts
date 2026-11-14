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
  idempotencyKey?: string;
  // QUEUED until claimed by the worker, then RUNNING.
  status: ExecutionStatus.QUEUED | ExecutionStatus.RUNNING;
  queuedAt: Date;
  startedAt: Date | null;
  // Normalized trigger payload, kept for debugging.
  context?: unknown;
}

export interface ExecutionStartRecord {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  triggerType: TriggerType;
  status: ExecutionStatus;
  queuedAt: Date;
  startedAt: Date | null;
}

export interface ExecutionHistoryQuery {
  workflowId: string;
  ownerId: string;
  workflowVersionId?: string;
  cursor?: string;
  limit: number;
}

export interface ExecutionHistoryItem {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  triggerType: TriggerType;
  status: ExecutionStatus;
  queuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
}

export interface ExecutionHistoryPage {
  items: ExecutionHistoryItem[];
  nextCursor: string | null;
}

export interface NodeLogRecord {
  nodeId: string;
  nodeKey: string;
  // SKIPPED: no incoming edge was activated, so the node did not run.
  status:
    | Exclude<
        ExecutionStatus,
        ExecutionStatus.QUEUED | ExecutionStatus.CANCELLED
      >
    | 'SKIPPED';
  input: unknown;
  output: unknown;
  errorMessage?: string;
  errorCode?: string;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface ResolvedCredential {
  connectorKey: string;
  secret: unknown;
}
