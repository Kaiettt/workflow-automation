import { Injectable, Optional } from '@nestjs/common';
import { ExecutionRepository } from '../../domain/repositories/execution.repository';
import { WorkflowVersionForExecution } from '../../domain/models/execution.types';
import {
  ExecutionStatus,
  TriggerType,
} from '../../domain/constants/execution.constants';
import {
  buildGraphPlan,
  edgeOutput,
  GraphPlan,
  MAIN_OUTPUT,
  WorkflowDefinition,
} from '../../domain/entities/workflow-execution.entity';
import { resolveOutputs } from '@app/shared/utils/node-outputs';
import { INodeExecutor } from '../../domain/entities/node-executor';
import {
  buildNodeNameIndex,
  ItemSource,
  NodeRun,
} from '../../domain/entities/run-state';
import { Item } from '../../domain/models/item';
import { NodeCatalogPort } from '../ports/node-catalog.port';
import {
  ExecutionEvent,
  ExecutionEventPublisher,
  publishExecutionEventSafely,
} from '../ports/execution-event-publisher.port';
import { NodeRunner } from './node-runner';
import { NodeExecutionObserver } from './node-execution-observer';

export interface StartRunInput {
  version: WorkflowVersionForExecution;
  triggerType: TriggerType;
  triggeredById: string | null;
  // Input of the first node: [] for a manual run, the payload for a webhook.
  triggerItems: Item[];
}

// Runs a published version node by node. Shared by the manual (synchronous)
// path and the queue processor (webhook).
@Injectable()
export class WorkflowEngine {
  private readonly catalog: NodeCatalogPort;
  private readonly runner: NodeRunner;
  private readonly observer: NodeExecutionObserver;
  private readonly eventPublisher?: ExecutionEventPublisher;

  constructor(
    private readonly repository: ExecutionRepository,
    executorsOrCatalog: INodeExecutor[] | NodeCatalogPort,
    catalogOrRunner?: NodeCatalogPort | NodeRunner,
    runnerOrObserver?:
      NodeRunner | NodeExecutionObserver | ExecutionEventPublisher,
    @Optional() eventPublisher?: ExecutionEventPublisher,
  ) {
    if (Array.isArray(executorsOrCatalog)) {
      // Legacy signature: (repository, executors, catalog, publisher?)
      const executors = executorsOrCatalog;
      this.catalog = catalogOrRunner as NodeCatalogPort;
      this.eventPublisher = runnerOrObserver as
        ExecutionEventPublisher | undefined;
      this.observer = new NodeExecutionObserver(
        repository,
        this.eventPublisher,
      );
      this.runner = NodeRunner.create(
        repository,
        executors,
        this.eventPublisher,
      );
    } else {
      // Clean DI signature: (repository, catalog, runner, observer, publisher?)
      this.catalog = executorsOrCatalog;
      this.runner = catalogOrRunner as NodeRunner;
      this.observer = runnerOrObserver as NodeExecutionObserver;
      this.eventPublisher = eventPublisher;
    }
  }

  // Throws when the definition cannot be run, before anything is stored.
  plan(definition: unknown): GraphPlan {
    return buildGraphPlan(definition);
  }

  async createExecution(input: StartRunInput, startedAt: Date) {
    return this.repository.createExecution({
      workflowId: input.version.workflowId,
      workflowVersionId: input.version.id,
      triggerType: input.triggerType,
      triggeredById: input.triggeredById,
      // A manual run starts at once; a background one waits for the queue.
      status:
        input.triggerType === TriggerType.MANUAL
          ? ExecutionStatus.RUNNING
          : ExecutionStatus.QUEUED,
      queuedAt: startedAt,
      startedAt: input.triggerType === TriggerType.MANUAL ? startedAt : null,
      context:
        input.triggerType === TriggerType.MANUAL
          ? undefined
          : { triggerItems: input.triggerItems },
    });
  }

  async run(
    executionId: string,
    version: WorkflowVersionForExecution,
    triggerItems: Item[],
    startedAt: Date,
  ): Promise<ExecutionStatus> {
    // Stays FAILED if anything unexpected throws (e.g. the database), so the
    // execution is never left RUNNING.
    let finalStatus = ExecutionStatus.FAILED;
    try {
      finalStatus = await this.runNodes(executionId, version, triggerItems);
    } finally {
      const finishedAt = new Date();
      await this.repository.finishExecution(
        executionId,
        finalStatus,
        finishedAt,
        finishedAt.getTime() - startedAt.getTime(),
      );
      const event: ExecutionEvent = {
        event:
          finalStatus === ExecutionStatus.SUCCESS
            ? 'execution.completed'
            : 'execution.failed',
        executionId,
        workflowId: version.workflowId,
        workflowVersionId: version.id,
        status: finalStatus,
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        ts: finishedAt.toISOString(),
      };
      await publishExecutionEventSafely(this.eventPublisher, event);
    }
    return finalStatus;
  }

  private async runNodes(
    executionId: string,
    version: WorkflowVersionForExecution,
    triggerItems: Item[],
  ): Promise<ExecutionStatus> {
    const { order, incoming } = this.plan(version.definition);
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

    const runs: NodeRun[] = [];
    // Items per output of the nodes that ran; nodes that were skipped are absent.
    const produced = new Map<
      string,
      { outputs: Map<string, Item[]>; offsets: Map<string, number> }
    >();
    let status = ExecutionStatus.SUCCESS;

    for (const nodeId of order) {
      const node = nodes.get(nodeId)!;
      const configSchema = configSchemas.get(node.data?.key);

      // An edge is active when its source ran and sent items to the output it
      // leaves from; the main output of a single-output node is always active,
      // even when empty, so a filter that drops everything still lets the next
      // node run.
      let items: Item[] = triggerItems;
      const inputSources: ItemSource[] = [];
      const edges = incoming.get(nodeId) ?? [];
      if (edges.length > 0) {
        items = [];
        let activated = false;
        for (const edge of edges) {
          const upstream = produced.get(edge.source);
          const key = edgeOutput(edge);
          const sent = upstream?.outputs.get(key);
          if (!upstream || !sent) continue;
          if (key !== MAIN_OUTPUT && sent.length === 0) continue;
          const offset = upstream.offsets.get(key) ?? 0;
          sent.forEach((item, index) => {
            items.push(item);
            inputSources.push({ nodeId: edge.source, index: offset + index });
          });
          activated = true;
        }
        if (!activated) {
          await this.observer.notifySkipped({
            executionId,
            workflowId: version.workflowId,
            workflowVersionId: version.id,
            nodeId: node.id,
            nodeKey: node.data?.key ?? 'unknown',
          });
          continue;
        }
      }

      const rawConfig =
        node.data?.config &&
        typeof node.data.config === 'object' &&
        !Array.isArray(node.data.config)
          ? (node.data.config as Record<string, unknown>)
          : {};
      const outputDefs = resolveOutputs(configSchema, rawConfig);
      const result = await this.runner.run({
        node,
        workflowId: version.workflowId,
        workflowVersionId: version.id,
        executionId,
        items,
        inputSources: edges.length > 0 ? inputSources : undefined,
        outputKeys: outputDefs.map((def) => def.key),
        runs,
        names,
        configSchema,
        credentialOwnerId: version.workflowOwnerId,
      });

      if (result.status === ExecutionStatus.FAILED) {
        status = ExecutionStatus.FAILED;
        break;
      }
      const offsets = new Map<string, number>();
      let offset = 0;
      for (const [key, sent] of result.outputs) {
        offsets.set(key, offset);
        offset += sent.length;
      }
      produced.set(node.id, { outputs: result.outputs, offsets });
      runs.push({
        nodeId: node.id,
        nodeName: typeof node.data.name === 'string' ? node.data.name : node.id,
        input: items,
        inputSources: edges.length > 0 ? inputSources : undefined,
        output: result.output,
      });
    }
    return status;
  }
}
