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
import { ExecutionStatus } from '../../../domain/constants/execution.constants';
import {
  getExecutionOrder,
  WorkflowDefinition,
} from '../../../domain/entities/workflow-execution.entity';
import { INodeExecutor } from '../../../domain/entities/node-executor';
import {
  buildNodeNameIndex,
  NodeRun,
} from '../../../domain/entities/run-state';
import { Item } from '../../../domain/models/item';
import { NodeCatalogPort } from '../../ports/node-catalog.port';
import { NodeRunner } from '../../services/node-runner';

@Injectable()
@CommandHandler(StartExecutionCommand)
export class StartExecutionHandler implements ICommandHandler<StartExecutionCommand> {
  private readonly runner: NodeRunner;

  constructor(
    private readonly repository: ExecutionRepository,
    @Inject('NODE_EXECUTORS') executors: INodeExecutor[],
    private readonly catalog: NodeCatalogPort,
  ) {
    this.runner = new NodeRunner(
      repository,
      new Map(executors.map((executor) => [executor.key, executor])),
    );
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

  private calculateExecutionOrder(definition: unknown): string[] {
    try {
      return getExecutionOrder(definition);
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
    const order = this.calculateExecutionOrder(version.definition);

    const definition = version.definition as WorkflowDefinition;
    const nodes = new Map(definition.nodes.map((node) => [node.id, node]));
    const names = buildNodeNameIndex(definition.nodes);
    // A malformed node without a key must fail on its own (no executor),
    // not break the catalog lookup for the whole run.
    const nodeKeys = definition.nodes
      .map((node) => node.data?.key)
      .filter((key): key is string => typeof key === 'string');
    const configSchemas = await this.catalog.getConfigSchemas([
      ...new Set(nodeKeys),
    ]);

    const startedAt = new Date();
    const executionId = await this.repository.createExecution({
      workflowId: version.workflowId,
      workflowVersionId: version.id,
      triggeredById: command.actorId,
      startedAt,
    });

    const runs: NodeRun[] = [];
    let items: Item[] = [];
    let finalStatus = ExecutionStatus.SUCCESS;

    for (const nodeId of order) {
      const node = nodes.get(nodeId)!;
      const result = await this.runner.run({
        node,
        items,
        runs,
        names,
        configSchema: configSchemas.get(node.data?.key),
        actorId: command.actorId,
      });

      await this.repository.saveNodeLog(executionId, result.log);

      if (result.status === ExecutionStatus.FAILED) {
        finalStatus = ExecutionStatus.FAILED;
        break;
      }
      runs.push({
        nodeId: node.id,
        nodeName: typeof node.data.name === 'string' ? node.data.name : node.id,
        input: items,
        output: result.output,
      });
      items = result.output;
    }

    const finishedAt = new Date();
    await this.repository.finishExecution(
      executionId,
      finalStatus,
      finishedAt,
      finishedAt.getTime() - startedAt.getTime(),
    );

    return this.repository.findExecutionResult(executionId);
  }
}
