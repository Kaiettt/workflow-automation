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
import { FALLBACK_OUTPUT, ruleOutputKey } from '@app/shared/utils/node-outputs';

const RuleSchema = z.object({
  // Identifies the rule's output: stays when rules are reordered or deleted.
  id: z.string().optional(),
  label: z.string().optional(),
  conditions: z
    .array(ConditionSchema)
    .min(1, 'Every Switch rule needs at least one condition'),
  combine: CombineSchema,
});

const ConfigSchema = z.object({
  rules: z.array(RuleSchema).min(1, 'Switch needs at least one rule'),
  // first: the item goes to the first rule that matches; all: to every rule that matches.
  mode: z.enum(['first', 'all']).default('first'),
  ...MatchOptionsShape,
});

export type SwitchConfig = z.infer<typeof ConfigSchema>;

// Sends every item to the output of the rule it matches, or to "fallback".
export class SwitchExecutor implements IPerItemExecutor<SwitchConfig> {
  readonly key = NodeKeys.LOGIC_SWITCH;
  readonly runMode = 'per_item' as const;

  parseConfig(raw: unknown): SwitchConfig {
    return ConfigSchema.parse(raw);
  }

  executeItem(params: {
    config: SwitchConfig;
    item: Item;
    credential: unknown;
  }): Promise<RoutedItem[]> {
    const { config, item } = params;
    const options = toMatchOptions(config);
    const routed: RoutedItem[] = [];
    for (let index = 0; index < config.rules.length; index += 1) {
      const rule = config.rules[index];
      if (!evaluateConditions(rule.conditions, rule.combine, options)) continue;
      routed.push(new RoutedItem(ruleOutputKey(rule, index), item.json));
      if (config.mode === 'first') break;
    }
    return Promise.resolve(
      routed.length > 0 ? routed : [new RoutedItem(FALLBACK_OUTPUT, item.json)],
    );
  }
}
