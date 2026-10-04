export type NodeExecutionStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'TIMEOUT';
export type ExecutionStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface NodeLogRecord {
  nodeId: string;
  nodeKey: string;
  status: NodeExecutionStatus | string;
  input: unknown;
  output: unknown;
  errorMessage?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

export interface ExecutionResult {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  status: ExecutionStatus | string;
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  nodeLogs?: NodeLogRecord[];
}

export interface StartExecutionRequest {
  workflow_version_id: string;
}
