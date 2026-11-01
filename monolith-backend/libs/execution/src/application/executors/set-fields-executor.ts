import { z } from 'zod';
import { IPerItemExecutor } from '../../domain/entities/node-executor';
import { NodeKeys } from '../../domain/constants/execution.constants';
import { Item, ItemJson, isPlainObject } from '../../domain/models/item';

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

const ConfigSchema = z.object({
  fields: z
    .array(
      z.object({
        // A path such as "customer.name".
        name: z.string().trim().min(1, 'Every field needs a name'),
        value: z.unknown(),
      }),
    )
    .default([]),
  keep_other_fields: z.boolean().default(true),
});

export type SetFieldsConfig = z.infer<typeof ConfigSchema>;

function setPath(target: ItemJson, path: string, value: unknown): void {
  const segments = path.split('.').map((segment) => segment.trim());
  if (segments.some((segment) => !segment || FORBIDDEN_SEGMENTS.has(segment))) {
    throw new Error(`"${path}" is not a valid field name`);
  }
  let node = target;
  for (const segment of segments.slice(0, -1)) {
    const next = node[segment];
    if (isPlainObject(next)) {
      node = next;
    } else {
      const created: ItemJson = {};
      node[segment] = created;
      node = created;
    }
  }
  node[segments[segments.length - 1]] = value;
}

// Adds or overwrites fields on every item (Edit Fields / Set).
export class SetFieldsExecutor implements IPerItemExecutor<SetFieldsConfig> {
  readonly key = NodeKeys.DATA_SET;
  readonly runMode = 'per_item' as const;

  parseConfig(raw: unknown): SetFieldsConfig {
    return ConfigSchema.parse(raw ?? {});
  }

  executeItem(params: {
    config: SetFieldsConfig;
    item: Item;
    credential: unknown;
  }): Promise<ItemJson> {
    const { config, item } = params;
    const output: ItemJson = config.keep_other_fields
      ? structuredClone(item.json)
      : {};
    for (const field of config.fields) {
      setPath(output, field.name, field.value ?? null);
    }
    return Promise.resolve(output);
  }
}
