import { ExecutionRepository } from '../../domain/repositories/execution.repository';
import { WorkflowVersionForExecution } from '../../domain/models/execution.types';
import {
  ExecutionStatus,
  TriggerType,
} from '../../domain/constants/execution.constants';
import {
  getExecutionOrder,
  WorkflowDefinition,
} from '../../domain/entities/workflow-execution.entity';
import { INodeExecutor } from '../../domain/entities/node-executor';
import { buildNodeNameIndex, NodeRun } from '../../domain/entities/run-state';
import { Item } from '../../domain/models/item';
import { NodeCatalogPort } from '../ports/node-catalog.port';
import { NodeRunner } from './node-runner';

export interface StartRunInput {
  version: WorkflowVersionForExecution;
  triggerType: TriggerType;
  triggeredById: string | null;
  // Input of the first node: [] for a manual run, the payload for a webhook.
  triggerItems: Item[];
}

// Runs a published version node by node. Shared by the manual (synchronous)
// path and the queue processor (webhook).
export class WorkflowEngine {
  private readonly runner: NodeRunner;

  constructor(
    private readonly repository: ExecutionRepository,
    executors: INodeExecutor[],
    private readonly catalog: NodeCatalogPort,
  ) {
    this.runner = new NodeRunner(
      repository,
      new Map(executors.map((executor) => [executor.key, executor])),
    );
  }

  // Throws when the definition cannot be run, before anything is stored.
  executionOrder(definition: unknown): string[] {
    return getExecutionOrder(definition);
  }

  async createExecution(input: StartRunInput, startedAt: Date) {
    return this.repository.createExecution({
      workflowId: input.version.workflowId,
      workflowVersionId: input.version.id,
      triggerType: input.triggerType,
      triggeredById: input.triggeredById,
      startedAt,
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
    }
    return finalStatus;
  }

  private async runNodes(
    executionId: string,
    version: WorkflowVersionForExecution,
    triggerItems: Item[],
  ): Promise<ExecutionStatus> {
    const order = this.executionOrder(version.definition);
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
    let items: Item[] = triggerItems;
    let status = ExecutionStatus.SUCCESS;

    for (const nodeId of order) {
      const node = nodes.get(nodeId)!;
      const result = await this.runner.run({
        node,
        items,
        runs,
        names,
        configSchema: configSchemas.get(node.data?.key),
        credentialOwnerId: version.workflowOwnerId,
      });

      await this.repository.saveNodeLog(executionId, result.log);

      if (result.status === ExecutionStatus.FAILED) {
        status = ExecutionStatus.FAILED;
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
    return status;
  }
}
