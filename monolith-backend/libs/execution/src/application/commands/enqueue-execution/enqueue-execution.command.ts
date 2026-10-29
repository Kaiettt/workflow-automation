import { Item } from '../../../domain/models/item';

// Starts a run in the background (webhook). Returns the execution id at once;
// the queue processor runs the nodes.
export class EnqueueExecutionCommand {
  constructor(
    readonly workflowVersionId: string,
    readonly triggerItems: Item[],
  ) {}
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ExecutionRepository } from '../../../domain/repositories/execution.repository';
import { TriggerType } from '../../../domain/constants/execution.constants';
import { ExecutionQueuePort } from '../../ports/execution-queue.port';
import { WorkflowEngine } from '../../services/workflow-engine';

@Injectable()
@CommandHandler(EnqueueExecutionCommand)
export class EnqueueExecutionHandler implements ICommandHandler<EnqueueExecutionCommand> {
  constructor(
    private readonly repository: ExecutionRepository,
    @Inject(WorkflowEngine) private readonly engine: WorkflowEngine,
    private readonly queue: ExecutionQueuePort,
  ) {}

  async execute(command: EnqueueExecutionCommand): Promise<string> {
    const version = await this.repository.findVersion(
      command.workflowVersionId,
    );
    if (!version) throw new NotFoundException('Workflow version not found');

    const startedAt = new Date();
    const executionId = await this.engine.createExecution(
      {
        version,
        triggerType: TriggerType.WEBHOOK,
        triggeredById: null,
        triggerItems: command.triggerItems,
      },
      startedAt,
    );
    await this.queue.enqueue({
      executionId,
      workflowVersionId: version.id,
      triggerItems: command.triggerItems,
      startedAt: startedAt.toISOString(),
    });
    return executionId;
  }
}
