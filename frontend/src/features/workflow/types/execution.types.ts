export type NodeExecutionStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'TIMEOUT';
export type ExecutionStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface NodeLogRecord {
  id?: string;
  nodeId: string;
  nodeKey: string;
  status: NodeExecutionStatus | string;
  input: unknown;
  output: unknown;
  errorMessage?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
}

export interface ExecutionResult {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  triggerType?: 'MANUAL' | 'WEBHOOK';
  status: ExecutionStatus | string;
  queuedAt?: string;
  startedAt: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  nodeLogs?: NodeLogRecord[];
}

export interface ExecutionHistoryItem extends Omit<ExecutionResult, 'nodeLogs'> {}

export interface ExecutionHistoryPage {
  items: ExecutionHistoryItem[];
  nextCursor: string | null;
}

export interface ListExecutionsRequest {
  workflowId: string;
  workflowVersionId?: string;
  cursor?: string;
  limit?: number;
}

export interface StartExecutionRequest {
  workflow_version_id: string;
}

export interface StartExecutionInput extends StartExecutionRequest {
  idempotency_key: string;
}
