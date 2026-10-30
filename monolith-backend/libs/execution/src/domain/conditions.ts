import { z } from 'zod';

export const CONDITION_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'regex',
  'is_empty',
  'is_not_empty',
  'gt',
  'lt',
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

const MAX_REGEX_LENGTH = 500;

export const ConditionSchema = z.object({
  // Usually an expression such as {{$json.text}}, so any JSON value can arrive.
  value1: z.unknown(),
  operator: z.enum(CONDITION_OPERATORS),
  value2: z.unknown().optional(),
});

export type Condition = z.infer<typeof ConditionSchema>;

export const CombineSchema = z.enum(['and', 'or']).default('and');

export interface MatchOptions {
  // Both default to on: customers type without capitals or Vietnamese accents.
  ignoreCase: boolean;
  ignoreAccents: boolean;
}

export const MatchOptionsShape = {
  ignore_case: z.boolean().default(true),
  ignore_accents: z.boolean().default(true),
};

export function toMatchOptions(config: {
  ignore_case: boolean;
  ignore_accents: boolean;
}): MatchOptions {
  return {
    ignoreCase: config.ignore_case,
    ignoreAccents: config.ignore_accents,
  };
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value) ?? '';
}

function fold(text: string, options: MatchOptions): string {
  let folded = text;
  if (options.ignoreAccents) {
    folded = folded
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }
  return options.ignoreCase ? folded.toLowerCase() : folded;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

function regexMatches(
  subject: string,
  pattern: string,
  options: MatchOptions,
): boolean {
  if (pattern.length > MAX_REGEX_LENGTH) {
    throw new Error(
      `A regular expression is limited to ${MAX_REGEX_LENGTH} characters`,
    );
  }
  let expression: RegExp;
  try {
    expression = new RegExp(pattern, options.ignoreCase ? 'i' : '');
  } catch {
    throw new Error(`"${pattern}" is not a valid regular expression`);
  }
  return expression.test(subject);
}

export function evaluateCondition(
  condition: Condition,
  options: MatchOptions,
): boolean {
  const { operator, value1, value2 } = condition;
  switch (operator) {
    case 'is_empty':
      return isEmpty(value1);
    case 'is_not_empty':
      return !isEmpty(value1);
    case 'gt': {
      const [a, b] = [toNumber(value1), toNumber(value2)];
      return Number.isFinite(a) && Number.isFinite(b) && a > b;
    }
    case 'lt': {
      const [a, b] = [toNumber(value1), toNumber(value2)];
      return Number.isFinite(a) && Number.isFinite(b) && a < b;
    }
    case 'regex':
      return regexMatches(toText(value1), toText(value2), options);
    default: {
      const a = fold(toText(value1), options);
      const b = fold(toText(value2), options);
      if (operator === 'equals') return a === b;
      if (operator === 'not_equals') return a !== b;
      if (operator === 'contains') return a.includes(b);
      if (operator === 'not_contains') return !a.includes(b);
      if (operator === 'starts_with') return a.startsWith(b);
      return a.endsWith(b);
    }
  }
}

// All conditions ("and") or at least one ("or") must hold.
export function evaluateConditions(
  conditions: Condition[],
  combine: 'and' | 'or',
  options: MatchOptions,
): boolean {
  return combine === 'and'
    ? conditions.every((condition) => evaluateCondition(condition, options))
    : conditions.some((condition) => evaluateCondition(condition, options));
}
