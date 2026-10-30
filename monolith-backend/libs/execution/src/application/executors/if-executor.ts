import { z } from 'zod';
import { IPerItemExecutor } from '../../domain/entities/node-executor';
import { NodeKeys } from '../../domain/constants/execution.constants';
import { Item, RoutedItem } from '../../domain/models/item';
import {
  CombineSchema,
  ConditionSchema,
  evaluateConditions,
  MatchOptionsShape,
  toMatchOptions,
} from '../../domain/conditions';

const ConfigSchema = z.object({
  conditions: z
    .array(ConditionSchema)
    .min(1, 'IF needs at least one condition'),
  combine: CombineSchema,
  ...MatchOptionsShape,
});

export type IfConfig = z.infer<typeof ConfigSchema>;

// Sends every item to "true" or "false" depending on its conditions.
export class IfExecutor implements IPerItemExecutor<IfConfig> {
  readonly key = NodeKeys.LOGIC_IF;
  readonly runMode = 'per_item' as const;

  parseConfig(raw: unknown): IfConfig {
    return ConfigSchema.parse(raw);
  }

  executeItem(params: {
    config: IfConfig;
    item: Item;
    credential: unknown;
  }): Promise<RoutedItem> {
    const { config, item } = params;
    const matched = evaluateConditions(
      config.conditions,
      config.combine,
      toMatchOptions(config),
    );
    return Promise.resolve(
      new RoutedItem(matched ? 'true' : 'false', item.json),
    );
  }
}
