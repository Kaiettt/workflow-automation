import { Inject, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ExecutionRepository } from '../../domain/repositories/execution.repository';
import { ExecutionStatus } from '../../domain/constants/execution.constants';
import { QueuedExecutionJob } from '../../application/ports/execution-queue.port';
import { WorkflowEngine } from '../../application/services/workflow-engine';
import { EXECUTION_QUEUE } from './execution-queue.module';

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_STALE_MINUTES = 15;

@Processor(EXECUTION_QUEUE)
export class ExecutionProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(ExecutionProcessor.name);

  constructor(
    private readonly repository: ExecutionRepository,
    @Inject(WorkflowEngine) private readonly engine: WorkflowEngine,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    this.worker.concurrency = positiveInt(
      process.env['EXECUTION_CONCURRENCY'],
      DEFAULT_CONCURRENCY,
    );

    // Executions left RUNNING by a process that died will never finish.
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
    const startedAt = new Date(job.data.startedAt);

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
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
