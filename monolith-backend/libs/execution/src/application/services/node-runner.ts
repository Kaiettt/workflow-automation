import { BadRequestException } from '@nestjs/common';
import { ExecutionRepository } from '../../domain/repositories/execution.repository';
import { NodeLogRecord } from '../../domain/models/execution.types';
import { ExecutionStatus } from '../../domain/constants/execution.constants';
import { WorkflowNode } from '../../domain/entities/workflow-execution.entity';
import {
  INodeExecutor,
  IOnceExecutor,
  IPerItemExecutor,
} from '../../domain/entities/node-executor';
import {
  createExpressionContext,
  NodeNameIndex,
  NodeRun,
} from '../../domain/entities/run-state';
import {
  applySchemaDefaults,
  resolveConfig,
} from '../../domain/expression/resolve-config';
import { isPlainObject, Item } from '../../domain/models/item';

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export interface NodeRunParams {
  node: WorkflowNode;
  items: Item[];
  runs: readonly NodeRun[];
  names: NodeNameIndex;
  configSchema: unknown;
  // Credentials are looked up for the workflow owner, also when no one
  // pressed Run (webhook).
  credentialOwnerId: string;
}

export interface NodeRunResult {
  log: NodeLogRecord;
  output: Item[];
  status: ExecutionStatus;
}

// Raised when a per_item node fails part-way; carries the progress summary for the log.
class ItemRunError extends Error {
  constructor(
    message: string,
    readonly summary: {
      total_items: number;
      processed: number;
      failed_at_index: number;
    },
  ) {
    super(message);
  }
}

export class NodeRunner {
  constructor(
    private readonly repository: ExecutionRepository,
    private readonly executors: ReadonlyMap<string, INodeExecutor>,
  ) {}

  async run(params: NodeRunParams): Promise<NodeRunResult> {
    const { node, items } = params;
    const startedAt = new Date();

    try {
      const executor = this.executors.get(node.data?.key);
      if (!executor) {
        throw new Error(
          `No executor registered for node key: ${String(node.data?.key)}`,
        );
      }

      const rawConfig = applySchemaDefaults(
        toRecord(node.data.config),
        params.configSchema,
      );
      const output =
        executor.runMode === 'once'
          ? await this.runOnce(executor, rawConfig, params)
          : await this.runPerItem(executor, rawConfig, params);

      return {
        log: {
          nodeId: node.id,
          nodeKey: node.data.key,
          status: ExecutionStatus.SUCCESS,
          input: items,
          output,
          startedAt,
          finishedAt: new Date(),
        },
        output,
        status: ExecutionStatus.SUCCESS,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Node execution failed';
      return {
        log: {
          nodeId: node.id,
          nodeKey: node.data?.key ?? 'unknown',
          status: ExecutionStatus.FAILED,
          input: items,
          output: error instanceof ItemRunError ? error.summary : null,
          errorMessage: sanitizeErrorText(message),
          startedAt,
          finishedAt: new Date(),
        },
        output: [],
        status: ExecutionStatus.FAILED,
      };
    }
  }

  private async runOnce(
    executor: IOnceExecutor,
    rawConfig: Record<string, unknown>,
    params: NodeRunParams,
  ): Promise<Item[]> {
    const secret = await this.resolveCredential(
      executor,
      rawConfig,
      params.credentialOwnerId,
    );
    const currentItem = params.items[0] ?? { json: {} };
    const config = executor.parseConfig(
      resolveConfig(
        rawConfig,
        params.configSchema,
        createExpressionContext({
          runs: params.runs,
          names: params.names,
          currentItem,
          currentIndex: 0,
        }),
      ),
    );

    const output = await executor.execute({
      config,
      items: params.items,
      credential: secret,
    });
    if (
      !Array.isArray(output) ||
      !output.every((item) => isPlainObject(item) && isPlainObject(item.json))
    ) {
      throw new Error('Node returned an invalid list of items');
    }
    return output;
  }

  private async runPerItem(
    executor: IPerItemExecutor,
    rawConfig: Record<string, unknown>,
    params: NodeRunParams,
  ): Promise<Item[]> {
    const { items } = params;
    // Nothing to process: no credential lookup, no config validation.
    if (items.length === 0) return [];

    const cap = executor.maxItems?.(rawConfig);
    if (cap && items.length > cap.limit) {
      throw new Error(
        `Node received ${items.length} items, which exceeds ${cap.reason}`,
      );
    }

    const secret = await this.resolveCredential(
      executor,
      rawConfig,
      params.credentialOwnerId,
    );
    const output: Item[] = [];

    for (let index = 0; index < items.length; index += 1) {
      try {
        const config = executor.parseConfig(
          resolveConfig(
            rawConfig,
            params.configSchema,
            createExpressionContext({
              runs: params.runs,
              names: params.names,
              currentItem: items[index],
              currentIndex: index,
            }),
          ),
        );
        const result = await executor.executeItem({
          config,
          item: items[index],
          credential: secret,
        });

        const jsons =
          result === null || result === undefined
            ? []
            : Array.isArray(result)
              ? result
              : [result];
        for (const json of jsons) {
          if (!isPlainObject(json)) {
            throw new Error('Node returned an invalid item');
          }
          output.push({ json, pairedItem: index });
        }
      } catch (error) {
        throw new ItemRunError(
          error instanceof Error ? error.message : 'Node execution failed',
          {
            total_items: items.length,
            processed: index,
            failed_at_index: index,
          },
        );
      }
    }
    return output;
  }

  // Runs once per node (not per item); credential_id is never an expression.
  private async resolveCredential(
    executor: INodeExecutor,
    rawConfig: Record<string, unknown>,
    ownerId: string,
  ): Promise<unknown> {
    const candidate = rawConfig.credential_id;
    if (candidate === undefined) return null;
    if (typeof candidate !== 'string' || !UUID_PATTERN.test(candidate)) {
      throw new BadRequestException('Invalid credential ID format');
    }

    const resolved = await this.repository.resolveCredential(
      candidate,
      ownerId,
    );
    if (!resolved) throw new Error('credential was not found');

    const expected = executor.expectedConnectorKey?.(rawConfig);
    if (expected && resolved.connectorKey !== expected) {
      throw new Error(
        `Credential does not belong to the "${expected}" connector`,
      );
    }
    return resolved.secret;
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

export function sanitizeErrorText(message: string): string {
  return message
    .replace(/\b(?:sk-ant-|sk-)[A-Za-z0-9_-]{16,}/g, '[REDACTED]')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}/g, '[REDACTED]')
    .replace(
      /(access_token|refresh_token|token|encrypted_secret|ENCRYPTION_KEY|client_secret|Bearer [A-Za-z0-9._~+/=-]+)/gi,
      '[REDACTED]',
    )
    .replace(/\b[a-fA-F0-9]{32,}\b/g, '[REDACTED]');
}
