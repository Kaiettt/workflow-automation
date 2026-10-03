import { ExecutionStatus } from '../constants/execution.constants';
import {
  WorkflowVersionForExecution,
  ExecutionRecord,
  NodeLogRecord,
} from '../models/execution.types';

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
    status: ExecutionStatus,
    finishedAt: Date,
    durationMs: number,
  ): Promise<void>;
  abstract findExecutionResult(id: string): Promise<unknown>;
}
