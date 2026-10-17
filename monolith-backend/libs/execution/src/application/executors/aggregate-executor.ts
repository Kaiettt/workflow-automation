import { z } from 'zod';
import { IOnceExecutor } from '../../domain/entities/node-executor';
import { NodeKeys } from '../../domain/constants/execution.constants';
import { Item } from '../../domain/models/item';

const ConfigSchema = z.object({
  field: z.string().min(1).default('items'),
});

export type AggregateConfig = z.infer<typeof ConfigSchema>;

// Turns many items into one: { [field]: [json of every input item] }.
export class AggregateExecutor implements IOnceExecutor<AggregateConfig> {
  readonly key = NodeKeys.DATA_AGGREGATE;
  readonly runMode = 'once' as const;

  parseConfig(raw: unknown): AggregateConfig {
    return ConfigSchema.parse(raw ?? {});
  }

  execute(params: {
    config: AggregateConfig;
    items: Item[];
    credential: unknown;
  }): Promise<Item[]> {
    return Promise.resolve([
      {
        json: { [params.config.field]: params.items.map((item) => item.json) },
      },
    ]);
  }
}
