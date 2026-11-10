import { Injectable } from '@nestjs/common';
import { IPerItemExecutor } from '../../../domain/entities/node-executor';
import { MAIN_OUTPUT } from '../../../domain/entities/workflow-execution.entity';
import { isPlainObject, Item, RoutedItem } from '../../../domain/models/item';
import { NodeConfigResolver } from '../node-config-resolver';
import { ItemRunError } from '../node-execution-observer';
import { NodeRunParams } from '../node-runner';

@Injectable()
export class PerItemExecutionStrategy {
  constructor(private readonly configResolver: NodeConfigResolver) {}

  async execute(
    executor: IPerItemExecutor,
    rawConfig: Record<string, unknown>,
    params: NodeRunParams,
  ): Promise<Map<string, Item[]>> {
    const { items } = params;
    const outputs = new Map<string, Item[]>(
      (params.outputKeys ?? [MAIN_OUTPUT]).map((key) => [key, []]),
    );

    // Nothing to process: no credential lookup, no config validation.
    if (items.length === 0) return outputs;

    const cap = executor.maxItems?.(rawConfig);
    if (cap && items.length > cap.limit) {
      throw new Error(
        `Node received ${items.length} items, which exceeds ${cap.reason}`,
      );
    }

    const secret = await this.configResolver.resolveCredential(
      executor,
      rawConfig,
      params.credentialOwnerId,
    );

    for (let index = 0; index < items.length; index += 1) {
      try {
        const config = this.configResolver.resolveItemConfig(
          executor,
          rawConfig,
          params.configSchema,
          {
            runs: params.runs,
            names: params.names,
            currentItem: items[index],
            currentIndex: index,
            currentSources: params.inputSources,
          },
        );
        const result = await executor.executeItem({
          config,
          item: items[index],
          credential: secret,
          context: {
            workflowId: params.workflowId,
            executionId: params.executionId,
          },
        });

        const jsons =
          result === null || result === undefined
            ? []
            : Array.isArray(result)
              ? result
              : [result];

        for (const entry of jsons) {
          const routed = entry instanceof RoutedItem;
          const json = routed ? entry.json : entry;
          if (!isPlainObject(json)) {
            throw new Error('Node returned an invalid item');
          }
          const key = routed ? entry.output : MAIN_OUTPUT;
          const target = outputs.get(key);
          if (!target) {
            throw new Error(
              `Node returned an item for an unknown output "${key}"`,
            );
          }
          target.push({ json, pairedItem: index });
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

    return outputs;
  }
}
