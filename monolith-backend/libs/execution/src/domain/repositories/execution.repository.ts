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
  // QUEUED -> RUNNING when the queue picks the run up. False when the run is
  // no longer queued (already failed or taken), so it must not run.
  abstract claimQueuedExecution(id: string, startedAt: Date): Promise<boolean>;
  // FAILED unless the run already finished (e.g. its job failed in the queue).
  abstract failUnfinishedExecution(id: string, finishedAt: Date): Promise<void>;
  // Marks MANUAL runs still RUNNING since before the cutoff as FAILED (the
  // request that ran them died with its process); returns how many changed.
  // Background runs are failed by the queue instead (see ExecutionProcessor).
  abstract failStaleExecutions(startedBefore: Date): Promise<number>;
}
