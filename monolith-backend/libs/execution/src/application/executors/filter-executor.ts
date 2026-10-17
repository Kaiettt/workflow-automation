import { IPerItemExecutor } from '../../domain/entities/node-executor';
import { NodeKeys } from '../../domain/constants/execution.constants';
import { Item, ItemJson } from '../../domain/models/item';
import { readField } from '../../domain/expression/path';

export type FilterOperator = 'equals' | 'not_equals' | 'contains';

export interface FilterConfig {
  // Path inside the item, e.g. "status" or "data.label".
  field: string;
  operator: FilterOperator;
  value: unknown;
}

const OPERATORS = new Set<FilterOperator>(['equals', 'not_equals', 'contains']);

export class FilterExecutor implements IPerItemExecutor<FilterConfig> {
  readonly key = NodeKeys.LOGIC_FILTER;
  readonly runMode = 'per_item' as const;

  parseConfig(raw: unknown): FilterConfig {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(
        'Filter config must be an object with field, operator, and value',
      );
    }
    const config = raw as Record<string, unknown>;
    if (typeof config.field !== 'string' || config.field.length === 0) {
      throw new Error('Filter config.field must be a non-empty string');
    }
    if (
      typeof config.operator !== 'string' ||
      !OPERATORS.has(config.operator as FilterOperator)
    ) {
      throw new Error(
        'Filter config.operator must be equals, not_equals, or contains',
      );
    }
    if (!('value' in config)) {
      throw new Error('Filter config.value is required');
    }
    return {
      field: config.field,
      operator: config.operator as FilterOperator,
      value: config.value,
    };
  }

  // Keeps the item unchanged when it matches, drops it otherwise.
  executeItem(params: {
    config: FilterConfig;
    item: Item;
    credential: unknown;
  }): Promise<ItemJson | null> {
    return Promise.resolve(
      matches(params.item.json, params.config) ? params.item.json : null,
    );
  }
}

function toComparableText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value) ?? '';
}

function matches(json: ItemJson, config: FilterConfig): boolean {
  const actual = readField(json, config.field);
  if (config.operator === 'equals') return actual === config.value;
  if (config.operator === 'not_equals') return actual !== config.value;
  return toComparableText(actual).includes(toComparableText(config.value));
}
