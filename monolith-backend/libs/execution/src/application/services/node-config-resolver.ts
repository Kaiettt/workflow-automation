import { BadRequestException, Injectable } from '@nestjs/common';
import { ExecutionRepository } from '../../domain/repositories/execution.repository';
import { INodeExecutor } from '../../domain/entities/node-executor';
import {
  createExpressionContext,
  ItemSource,
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

export function toRecord(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

@Injectable()
export class NodeConfigResolver {
  constructor(private readonly repository: ExecutionRepository) {}

  applyDefaults(
    config: unknown,
    configSchema: unknown,
  ): Record<string, unknown> {
    return applySchemaDefaults(toRecord(config), configSchema);
  }

  async resolveCredential(
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

  resolveItemConfig(
    executor: INodeExecutor,
    rawConfig: Record<string, unknown>,
    configSchema: unknown,
    contextParams: {
      runs: readonly NodeRun[];
      names: NodeNameIndex;
      currentItem: Item;
      currentIndex: number;
      currentSources?: readonly ItemSource[];
    },
  ): unknown {
    const context = createExpressionContext(contextParams);
    const resolved = resolveConfig(rawConfig, configSchema, context);
    return executor.parseConfig(resolved);
  }
}
