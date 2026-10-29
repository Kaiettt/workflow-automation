export class StartExecutionCommand {
  constructor(
    readonly workflowVersionId: string,
    readonly actorId: string,
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
import { INodeExecutor } from '../../../domain/entities/node-executor';
import { NodeCatalogPort } from '../../ports/node-catalog.port';
import { WorkflowEngine } from '../../services/workflow-engine';

// Manual run: executes synchronously and returns the result in the response.
@Injectable()
@CommandHandler(StartExecutionCommand)
export class StartExecutionHandler implements ICommandHandler<StartExecutionCommand> {
  private readonly engine: WorkflowEngine;

  constructor(
    private readonly repository: ExecutionRepository,
    @Inject('NODE_EXECUTORS') executors: INodeExecutor[],
    catalog: NodeCatalogPort,
  ) {
    this.engine = new WorkflowEngine(repository, executors, catalog);
  }

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
      this.engine.executionOrder(definition);
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

    const startedAt = new Date();
    const executionId = await this.engine.createExecution(
      {
        version,
        triggerType: TriggerType.MANUAL,
        triggeredById: command.actorId,
        triggerItems: [],
      },
      startedAt,
    );
    await this.engine.run(executionId, version, [], startedAt);

    return this.repository.findExecutionResult(executionId);
  }
}
