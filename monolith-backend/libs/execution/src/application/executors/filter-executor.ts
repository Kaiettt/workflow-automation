import { INodeExecutor } from '../../domain/entities/node-executor';
import { NodeKeys } from '../../domain/constants/execution.constants';

export type FilterOperator = 'equals' | 'not_equals' | 'contains';

export interface FilterConfig {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export type FilterRow = Record<string, unknown>;

const OPERATORS = new Set<FilterOperator>(['equals', 'not_equals', 'contains']);

export class FilterExecutor implements INodeExecutor<
  FilterConfig,
  FilterRow[],
  FilterRow[]
> {
  readonly key = NodeKeys.LOGIC_FILTER;

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

  parseInput(raw: unknown): FilterRow[] {
    if (!Array.isArray(raw)) {
      throw new Error('Filter input must be an array of objects');
    }
    return raw.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(
          `Filter input item at index ${index} must be an object`,
        );
      }
      return item as FilterRow;
    });
  }

  execute(params: {
    config: FilterConfig;
    input: FilterRow[] | null;
    credential: unknown;
  }): Promise<FilterRow[]> {
    if (params.input === null) {
      throw new Error('Filter input must be an array of objects');
    }
    return Promise.resolve(
      params.input.filter((row) => matches(row, params.config)),
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

function matches(row: FilterRow, config: FilterConfig): boolean {
  const actual = row[config.field];
  if (config.operator === 'equals') return actual === config.value;
  if (config.operator === 'not_equals') return actual !== config.value;
  return toComparableText(actual).includes(toComparableText(config.value));
}
