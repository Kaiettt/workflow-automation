import { isPlainObject } from '../models/item';
import { ExpressionError } from './errors';
import { evaluateTemplate, ExpressionContext, parseTemplate } from './template';

function schemaProperties(configSchema: unknown): Record<string, unknown> {
  if (!isPlainObject(configSchema)) return {};
  const properties = configSchema['properties'];
  return isPlainObject(properties) ? properties : {};
}

// Fills keys that are missing from the config with the `default` declared in the schema.
export function applySchemaDefaults(
  rawConfig: Record<string, unknown>,
  configSchema: unknown,
): Record<string, unknown> {
  const config = { ...rawConfig };
  for (const [key, schema] of Object.entries(schemaProperties(configSchema))) {
    if (
      isPlainObject(schema) &&
      schema['default'] !== undefined &&
      (config[key] === undefined || config[key] === null)
    ) {
      config[key] = schema['default'];
    }
  }
  return config;
}

// Resolves {{...}} in a value, going into lists of objects (conditions, rules,
// fields) by their `items` schema. Only string fields the schema marks with
// x-allowExpression are touched.
function resolveValue(
  value: unknown,
  schema: unknown,
  ctx: ExpressionContext,
  path: string,
): unknown {
  if (!isPlainObject(schema)) return value;
  if (typeof value === 'string') {
    if (schema['x-allowExpression'] !== true || !value.includes('{{')) {
      return value;
    }
    try {
      return evaluateTemplate(parseTemplate(value), ctx);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ExpressionError(`Config "${path}": ${reason}`);
    }
  }
  if (Array.isArray(value)) {
    const items = schema['items'];
    return isPlainObject(items)
      ? value.map((entry, index) =>
          resolveValue(entry, items, ctx, `${path}[${index}]`),
        )
      : value;
  }
  if (isPlainObject(value)) {
    const properties = schema['properties'];
    if (!isPlainObject(properties)) return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        resolveValue(entry, properties[key], ctx, `${path}.${key}`),
      ]),
    );
  }
  return value;
}

export function resolveConfig(
  rawConfig: Record<string, unknown>,
  configSchema: unknown,
  ctx: ExpressionContext,
): Record<string, unknown> {
  const properties = schemaProperties(configSchema);
  return Object.fromEntries(
    Object.entries(rawConfig).map(([key, value]) => [
      key,
      resolveValue(value, properties[key], ctx, key),
    ]),
  );
}
