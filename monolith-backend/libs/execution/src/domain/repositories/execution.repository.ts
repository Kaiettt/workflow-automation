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
  status: 'SUCCESS' | 'FAILED';
  input: unknown;
  output: unknown;
  errorMessage?: string;
  startedAt: Date;
  finishedAt: Date;
}

export abstract class ExecutionRepository {
  abstract findVersion(id: string): Promise<WorkflowVersionForExecution | null>;
  abstract createExecution(input: Omit<ExecutionRecord, 'id'>): Promise<string>;
  abstract resolveCredential(
    credentialId: string,
    ownerId: string,
  ): Promise<unknown>;
  abstract saveNodeLog(executionId: string, log: NodeLogRecord): Promise<void>;
  abstract finishExecution(
    id: string,
    status: 'SUCCESS' | 'FAILED',
    finishedAt: Date,
    durationMs: number,
  ): Promise<void>;
  abstract findExecutionResult(id: string): Promise<unknown>;
}
