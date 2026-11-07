export class StartExecutionCommand {
  constructor(
    readonly workflowVersionId: string,
    readonly actorId: string,
    readonly idempotencyKey?: string,
  ) {}
}

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ExecutionRepository } from '../../../domain/repositories/execution.repository';
import { WorkflowVersionForExecution } from '../../../domain/models/execution.types';
import { TriggerType } from '../../../domain/constants/execution.constants';
import { ExecutionStarter } from '../../services/execution-starter';
import { WorkflowEngine } from '../../services/workflow-engine';

// Manual run: validates the published version and queues it for the worker.
@Injectable()
@CommandHandler(StartExecutionCommand)
export class StartExecutionHandler implements ICommandHandler<StartExecutionCommand> {
  constructor(
    private readonly repository: ExecutionRepository,
    @Inject(WorkflowEngine) private readonly engine: WorkflowEngine,
    private readonly starter: ExecutionStarter,
  ) {}

  private async validateAndFetchWorkflow(
    versionId: string,
    actorId: string,
  ): Promise<WorkflowVersionForExecution> {
    const version = await this.repository.findVersion(versionId);
    if (!version) throw new NotFoundException('Workflow version not found');

    const isAllowed = version.workflowOwnerId === actorId;
    if (!isAllowed) {
      throw new ForbiddenException('You cannot run this workflow');
    }
    return version;
  }

  private checkExecutionOrder(definition: unknown): void {
    try {
      this.engine.plan(definition);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid workflow definition',
      );
    }
  }

  async execute(command: StartExecutionCommand) {
    const version = await this.validateAndFetchWorkflow(
      command.workflowVersionId,
      command.actorId,
    );
    this.checkExecutionOrder(version.definition);

    const accepted = await this.starter.start({
      version,
      triggerType: TriggerType.MANUAL,
      triggeredById: command.actorId,
      triggerItems: [],
      idempotencyKey: command.idempotencyKey,
    });
    return accepted;
  }
}
