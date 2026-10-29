import { ExecutionStatus } from '../constants/execution.constants';
import {
  WorkflowVersionForExecution,
  ExecutionRecord,
  NodeLogRecord,
  ResolvedCredential,
} from '../models/execution.types';

export abstract class ExecutionRepository {
  abstract findVersion(id: string): Promise<WorkflowVersionForExecution | null>;
  abstract createExecution(input: Omit<ExecutionRecord, 'id'>): Promise<string>;
  abstract resolveCredential(
    credentialId: string,
    ownerId: string,
  ): Promise<ResolvedCredential>;
  abstract saveNodeLog(executionId: string, log: NodeLogRecord): Promise<void>;
  abstract finishExecution(
    id: string,
    status: ExecutionStatus,
    finishedAt: Date,
    durationMs: number,
  ): Promise<void>;
  abstract findExecutionResult(id: string): Promise<unknown>;
  // Marks executions still RUNNING since before the cutoff as FAILED
  // (their process died); returns how many were changed.
  abstract failStaleExecutions(startedBefore: Date): Promise<number>;
}
