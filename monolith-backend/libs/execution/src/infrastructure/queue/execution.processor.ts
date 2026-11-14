import { Inject, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ExecutionRepository } from '../../domain/repositories/execution.repository';
import { ExecutionStatus } from '../../domain/constants/execution.constants';
import { QueuedExecutionJob } from '../../application/ports/execution-queue.port';
import { WorkflowEngine } from '../../application/services/workflow-engine';
import {
  ExecutionEventPublisher,
  publishExecutionEventSafely,
} from '../../application/ports/execution-event-publisher.port';
import { EXECUTION_QUEUE } from './execution-queue.module';

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_STALE_MINUTES = 15;

// A run is never replayed: nodes may already have sent emails or messages.
// maxStalledCount 0 makes BullMQ fail a job whose worker died (instead of
// running it again); the `failed` event then marks its execution FAILED.
@Processor(EXECUTION_QUEUE, { maxStalledCount: 0 })
export class ExecutionProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(ExecutionProcessor.name);

  constructor(
    private readonly repository: ExecutionRepository,
    @Inject(WorkflowEngine) private readonly engine: WorkflowEngine,
    private readonly eventPublisher?: ExecutionEventPublisher,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    this.worker.concurrency = positiveInt(
      process.env['EXECUTION_CONCURRENCY'],
      DEFAULT_CONCURRENCY,
    );

    // Manual runs left RUNNING by a process that died will never finish.
    const staleMinutes = positiveInt(
      process.env['EXECUTION_STALE_MINUTES'],
      DEFAULT_STALE_MINUTES,
    );
    const failed = await this.repository.failStaleExecutions(
      new Date(Date.now() - staleMinutes * 60_000),
    );
    if (failed > 0) {
      this.logger.warn(`Marked ${failed} stale RUNNING execution(s) FAILED`);
    }
  }

  async process(job: Job<QueuedExecutionJob>): Promise<ExecutionStatus> {
    const { executionId, workflowVersionId, triggerItems } = job.data;
    const startedAt = new Date();

    // Only a QUEUED run starts; anything else already failed or is taken.
    if (!(await this.repository.claimQueuedExecution(executionId, startedAt))) {
      const current = await this.repository.findExecutionResult(executionId);
      if (
        current &&
        typeof current === 'object' &&
        'status' in current &&
        current.status === ExecutionStatus.CANCELLED
      ) {
        await publishExecutionEventSafely(this.eventPublisher, {
          event: 'execution.cancelled',
          executionId,
          status: ExecutionStatus.CANCELLED,
          finishedAt: startedAt.toISOString(),
          ts: startedAt.toISOString(),
        });
        return ExecutionStatus.CANCELLED;
      }
      this.logger.warn(`Execution ${executionId} is not queued any more`);
      return ExecutionStatus.FAILED;
    }

    const version = await this.repository.findVersion(workflowVersionId);
    if (!version) {
      await this.repository.finishExecution(
        executionId,
        ExecutionStatus.FAILED,
        new Date(),
        Date.now() - startedAt.getTime(),
      );
      return ExecutionStatus.FAILED;
    }

    try {
      await publishExecutionEventSafely(this.eventPublisher, {
        event: 'execution.started',
        executionId,
        workflowId: version.workflowId,
        workflowVersionId: version.id,
        status: ExecutionStatus.RUNNING,
        startedAt: startedAt.toISOString(),
        ts: startedAt.toISOString(),
      });

      return await this.engine.run(
        executionId,
        version,
        triggerItems,
        startedAt,
      );
    } catch (error) {
      // engine.run already stored FAILED; keep the reason in the server log.
      this.logger.error(
        `Execution ${executionId} crashed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return ExecutionStatus.FAILED;
    }
  }

  // Also fires for a job whose worker died (stalled), which never reached
  // process() again.
  @OnWorkerEvent('failed')
  async onFailed(job: Job<QueuedExecutionJob> | undefined): Promise<void> {
    const executionId = job?.data?.executionId;
    if (!executionId) return;
    try {
      await this.repository.failUnfinishedExecution(executionId, new Date());
    } catch (error) {
      this.logger.error(
        `Could not mark execution ${executionId} FAILED: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
