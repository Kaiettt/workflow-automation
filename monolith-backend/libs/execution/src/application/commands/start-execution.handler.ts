import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  ExecutionRepository,
  NodeLogRecord,
} from '../../domain/repositories/execution.repository';
import {
  getExecutionOrder,
  WorkflowDefinition,
} from '../../domain/entities/workflow-execution.entity';
import { INodeExecutor } from '../../domain/entities/node-executor';
import { StartExecutionCommand } from './start-execution.command';

@Injectable()
@CommandHandler(StartExecutionCommand)
export class StartExecutionHandler implements ICommandHandler<StartExecutionCommand> {
  private readonly executors: ReadonlyMap<string, INodeExecutor>;

  constructor(
    private readonly repository: ExecutionRepository,
    @Inject('NODE_EXECUTORS') executors: INodeExecutor[],
  ) {
    this.executors = new Map(
      executors.map((executor) => [executor.key, executor]),
    );
  }

  private async resolveNodeCredential(
    node: WorkflowDefinition['nodes'][number],
    actorId: string,
  ): Promise<unknown> {
    const config = node.data?.config;
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return null;
    }

    const candidate = (config as Record<string, unknown>).credential_id;
    if (candidate === undefined) {
      return null;
    }
    if (typeof candidate !== 'string') {
      throw new BadRequestException('Credential id must be a UUID string');
    }
    if (candidate === 'google-credential') {
      throw new BadRequestException('Invalid Google credential id');
    }
    if (
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        candidate,
      )
    ) {
      throw new BadRequestException('Invalid Google credential id');
    }

    return this.repository.resolveCredential(candidate, actorId);
  }

  async execute(command: StartExecutionCommand) {
    const version = await this.repository.findVersion(
      command.workflowVersionId,
    );
    if (!version) throw new NotFoundException('Workflow version not found');
    if (version.workflowOwnerId !== command.actorId)
      throw new ForbiddenException('You cannot run this workflow');
    let order: string[];
    try {
      order = getExecutionOrder(version.definition);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid workflow definition',
      );
    }
    const definition = version.definition as WorkflowDefinition;
    const nodes = new Map(definition.nodes.map((node) => [node.id, node]));
    const startedAt = new Date();
    const executionId = await this.repository.createExecution({
      workflowId: version.workflowId,
      workflowVersionId: version.id,
      triggeredById: command.actorId,
      startedAt,
    });
    let input: unknown = null;
    let status: 'SUCCESS' | 'FAILED' = 'SUCCESS';
    for (const nodeId of order) {
      const node = nodes.get(nodeId)!;
      const nodeStartedAt = new Date();
      const executor = this.executors.get(node.data?.key);
      let log: NodeLogRecord;
      try {
        if (!executor)
          throw new Error(
            `No executor registered for node key: ${String(node.data?.key)}`,
          );
        const config = executor.parseConfig
          ? executor.parseConfig(node.data.config ?? {})
          : (node.data.config ?? {});
        const parsedInput = executor.parseInput
          ? executor.parseInput(input)
          : input;
        const credential = await this.resolveNodeCredential(
          node,
          command.actorId,
        );
        const output = await executor.execute({
          config,
          input: parsedInput,
          credential,
        });
        log = {
          nodeId,
          nodeKey: node.data.key,
          status: 'SUCCESS',
          input: parsedInput,
          output,
          startedAt: nodeStartedAt,
          finishedAt: new Date(),
        };
        input = output;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Node execution failed';
        const summary =
          typeof error === 'object' && error !== null && 'summary' in error
            ? (error as { summary?: unknown }).summary
            : null;
        log = {
          nodeId,
          nodeKey: node.data?.key ?? 'unknown',
          status: 'FAILED',
          input,
          output: summary,
          errorMessage: sanitizeErrorText(message),
          startedAt: nodeStartedAt,
          finishedAt: new Date(),
        };
        status = 'FAILED';
      }
      await this.repository.saveNodeLog(executionId, log);
      if (log.status === 'FAILED') break;
    }
    const finishedAt = new Date();
    await this.repository.finishExecution(
      executionId,
      status,
      finishedAt,
      finishedAt.getTime() - startedAt.getTime(),
    );
    return this.repository.findExecutionResult(executionId);
  }
}

function sanitizeErrorText(message: string): string {
  return message
    .replace(
      /(access_token|refresh_token|token|encrypted_secret|ENCRYPTION_KEY|client_secret|Bearer [A-Za-z0-9._~+/=-]+)/gi,
      '[REDACTED]',
    )
    .replace(/\b[a-fA-F0-9]{32,}\b/g, '[REDACTED]');
}
