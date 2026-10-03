import { ExecutionStatus } from '../constants/execution.constants';

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
  triggeredById: string;
  startedAt: Date;
}

export interface NodeLogRecord {
  nodeId: string;
  nodeKey: string;
  status: ExecutionStatus;
  input: unknown;
  output: unknown;
  errorMessage?: string;
  startedAt: Date;
  finishedAt: Date;
}
