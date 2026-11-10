import { Inject, Injectable } from '@nestjs/common';
import { ExecutionRepository } from '../../domain/repositories/execution.repository';
import { NodeLogRecord } from '../../domain/models/execution.types';
import { ExecutionStatus } from '../../domain/constants/execution.constants';
import { WorkflowNode } from '../../domain/entities/workflow-execution.entity';
import { INodeExecutor } from '../../domain/entities/node-executor';
import {
  ItemSource,
  NodeNameIndex,
  NodeRun,
} from '../../domain/entities/run-state';
import { Item } from '../../domain/models/item';
import { ExecutionEventPublisher } from '../ports/execution-event-publisher.port';
import {
  ItemRunError,
  NodeExecutionObserver,
  sanitizeErrorText,
} from './node-execution-observer';
import { NodeConfigResolver } from './node-config-resolver';
import { OnceExecutionStrategy } from './strategies/once-execution.strategy';
import { PerItemExecutionStrategy } from './strategies/per-item-execution.strategy';

export { ItemRunError, sanitizeErrorText };

export interface NodeRunParams {
  node: WorkflowNode;
  workflowId: string;
  workflowVersionId?: string;
  executionId: string;
  items: Item[];
  // Where each input item came from; absent for the start node.
  inputSources?: readonly ItemSource[];
  // Keys of the node's outputs; absent means the single main output.
  outputKeys?: readonly string[];
  runs: readonly NodeRun[];
  names: NodeNameIndex;
  configSchema: unknown;
  // Credentials are looked up for the workflow owner, also when no one
  // pressed Run (webhook).
  credentialOwnerId: string;
}

export interface NodeRunResult {
  log: NodeLogRecord;
  // Every output item (all outputs, in declaration order) and the items per output.
  output: Item[];
  outputs: Map<string, Item[]>;
  status: ExecutionStatus;
}

@Injectable()
export class NodeRunner {
  private readonly configResolver: NodeConfigResolver;
  private readonly observer: NodeExecutionObserver;
  private readonly onceStrategy: OnceExecutionStrategy;
  private readonly perItemStrategy: PerItemExecutionStrategy;
  private readonly executors: ReadonlyMap<string, INodeExecutor>;

  constructor(
    configResolverOrRepo: NodeConfigResolver | ExecutionRepository,
    observerOrExecutors:
      NodeExecutionObserver | ReadonlyMap<string, INodeExecutor>,
    onceStrategyOrPublisher?: OnceExecutionStrategy | ExecutionEventPublisher,
    perItemStrategy?: PerItemExecutionStrategy,
    @Inject('NODE_EXECUTORS_MAP')
    executorsMap?: ReadonlyMap<string, INodeExecutor>,
  ) {
    // Injected DI signature: (configResolver, observer, onceStrategy, perItemStrategy, executorsMap)
    if (
      perItemStrategy !== undefined ||
      (configResolverOrRepo &&
        typeof (configResolverOrRepo as NodeConfigResolver).applyDefaults ===
          'function')
    ) {
      this.configResolver = configResolverOrRepo as NodeConfigResolver;
      this.observer = observerOrExecutors as NodeExecutionObserver;
      this.onceStrategy = onceStrategyOrPublisher as OnceExecutionStrategy;
      this.perItemStrategy = perItemStrategy as PerItemExecutionStrategy;
      this.executors = executorsMap ?? new Map();
    } else {
      // Backward-compatible signature: (repository, executorsMap, eventPublisher?)
      const repo = configResolverOrRepo as ExecutionRepository;
      const publisher = onceStrategyOrPublisher as
        ExecutionEventPublisher | undefined;
      const rawExecutors = observerOrExecutors as ReadonlyMap<
        string,
        INodeExecutor
      >;
      this.configResolver = new NodeConfigResolver(repo);
      this.observer = new NodeExecutionObserver(repo, publisher);
      this.onceStrategy = new OnceExecutionStrategy(this.configResolver);
      this.perItemStrategy = new PerItemExecutionStrategy(this.configResolver);
      this.executors = rawExecutors;
    }
  }

  static create(
    repository: ExecutionRepository,
    executors: ReadonlyMap<string, INodeExecutor> | INodeExecutor[],
    eventPublisher?: ExecutionEventPublisher,
  ): NodeRunner {
    const executorsMap =
      executors instanceof Map
        ? executors
        : Array.isArray(executors)
          ? new Map(executors.map((e) => [e.key, e]))
          : executors;
    const resolver = new NodeConfigResolver(repository);
    const observer = new NodeExecutionObserver(repository, eventPublisher);
    const once = new OnceExecutionStrategy(resolver);
    const perItem = new PerItemExecutionStrategy(resolver);
    return new NodeRunner(resolver, observer, once, perItem, executorsMap);
  }

  async run(params: NodeRunParams): Promise<NodeRunResult> {
    const startedAt = new Date();
    await this.observer.notifyStarted(params, startedAt);

    try {
      const executor = this.executors.get(params.node.data?.key);
      if (!executor) {
        throw new Error(
          `No executor registered for node key: ${String(params.node.data?.key)}`,
        );
      }

      const rawConfig = this.configResolver.applyDefaults(
        params.node.data?.config,
        params.configSchema,
      );

      const outputs =
        executor.runMode === 'once'
          ? await this.onceStrategy.execute(executor, rawConfig, params)
          : await this.perItemStrategy.execute(executor, rawConfig, params);

      return await this.observer.notifyCompleted(
        params,
        outputs,
        startedAt,
        new Date(),
      );
    } catch (error) {
      return await this.observer.notifyFailed(
        params,
        error,
        startedAt,
        new Date(),
      );
    }
  }
}
