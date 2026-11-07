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
import { ExecutionStarter } from '../../services/execution-starter';

@Injectable()
@CommandHandler(EnqueueExecutionCommand)
export class EnqueueExecutionHandler implements ICommandHandler<EnqueueExecutionCommand> {
  constructor(
    private readonly repository: ExecutionRepository,
    private readonly starter: ExecutionStarter,
  ) {}

  async execute(command: EnqueueExecutionCommand): Promise<string> {
    const version = await this.repository.findVersion(
      command.workflowVersionId,
    );
    if (!version) throw new NotFoundException('Workflow version not found');

    const accepted = await this.starter.start({
      version,
      triggerType: TriggerType.WEBHOOK,
      triggeredById: null,
      triggerItems: command.triggerItems,
    });
    return accepted.id;
  }
}
