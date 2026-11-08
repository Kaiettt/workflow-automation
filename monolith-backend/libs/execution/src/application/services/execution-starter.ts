import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ExecutionQueuePort } from '../ports/execution-queue.port';
import { ExecutionRepository } from '../../domain/repositories/execution.repository';
import {
  ExecutionStatus,
  TriggerType,
} from '../../domain/constants/execution.constants';
import {
  ExecutionStartRecord,
  WorkflowVersionForExecution,
} from '../../domain/models/execution.types';
import { Item } from '../../domain/models/item';
import {
  ExecutionEventPublisher,
  ExecutionEvent,
} from '../ports/execution-event-publisher.port';

export interface StartQueuedExecutionInput {
  version: WorkflowVersionForExecution;
  triggerType: TriggerType;
  triggeredById: string | null;
  triggerItems: Item[];
  idempotencyKey?: string;
}

export interface QueuedExecutionAcceptance {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  triggerType: TriggerType;
  status: ExecutionStatus;
  queuedAt: Date;
  startedAt: Date | null;
}

@Injectable()
export class ExecutionStarter {
  constructor(
    private readonly repository: ExecutionRepository,
    @Inject(ExecutionQueuePort) private readonly queue: ExecutionQueuePort,
    private readonly eventPublisher?: ExecutionEventPublisher,
  ) {}

  async start(
    input: StartQueuedExecutionInput,
  ): Promise<QueuedExecutionAcceptance> {
    const existing = await this.findExisting(input);
    if (existing) return this.acceptExisting(existing, input.version.id);

    const queuedAt = new Date();
    let executionId: string;
    try {
      executionId = await this.repository.createExecution({
        workflowId: input.version.workflowId,
        workflowVersionId: input.version.id,
        triggerType: input.triggerType,
        triggeredById: input.triggeredById,
        idempotencyKey: input.idempotencyKey,
        status: ExecutionStatus.QUEUED,
        queuedAt,
        startedAt: null,
        context: { triggerItems: input.triggerItems },
      });
    } catch (error) {
      const concurrent = await this.findExisting(input);
      if (concurrent) return this.acceptExisting(concurrent, input.version.id);
      throw error;
    }

    try {
      await this.queue.enqueue({
        executionId,
        workflowVersionId: input.version.id,
        triggerItems: input.triggerItems,
        queuedAt: queuedAt.toISOString(),
      });
    } catch (error) {
      await this.repository.failUnfinishedExecution(executionId, new Date());
      throw error;
    }

    const queuedEvent: ExecutionEvent = {
      event: 'execution.queued',
      executionId,
      workflowId: input.version.workflowId,
      workflowVersionId: input.version.id,
      status: ExecutionStatus.QUEUED,
      startedAt: null,
      finishedAt: null,
      ts: queuedAt.toISOString(),
    };
    await this.eventPublisher?.publish(queuedEvent);

    return {
      id: executionId,
      workflowId: input.version.workflowId,
      workflowVersionId: input.version.id,
      triggerType: input.triggerType,
      status: ExecutionStatus.QUEUED,
      queuedAt,
      startedAt: null,
    };
  }

  private findExisting(input: StartQueuedExecutionInput) {
    if (!input.idempotencyKey || !input.triggeredById) {
      return Promise.resolve(null);
    }
    return this.repository.findExecutionByIdempotencyKey(
      input.triggeredById,
      input.idempotencyKey,
    );
  }

  private acceptExisting(
    existing: ExecutionStartRecord,
    workflowVersionId: string,
  ): QueuedExecutionAcceptance {
    if (existing.workflowVersionId !== workflowVersionId) {
      throw new ConflictException(
        'Idempotency key was already used for a different workflow version',
      );
    }
    return existing;
  }
}
