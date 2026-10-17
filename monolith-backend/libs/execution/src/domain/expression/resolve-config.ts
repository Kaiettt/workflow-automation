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

// Resolves {{...}} only in string fields the schema marks with x-allowExpression.
export function resolveConfig(
  rawConfig: Record<string, unknown>,
  configSchema: unknown,
  ctx: ExpressionContext,
): Record<string, unknown> {
  const properties = schemaProperties(configSchema);
  const config = { ...rawConfig };
  for (const [key, value] of Object.entries(rawConfig)) {
    const schema = properties[key];
    if (
      !isPlainObject(schema) ||
      schema['x-allowExpression'] !== true ||
      typeof value !== 'string' ||
      !value.includes('{{')
    ) {
      continue;
    }
    try {
      config[key] = evaluateTemplate(parseTemplate(value), ctx);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ExpressionError(`Config "${key}": ${reason}`);
    }
  }
  return config;
}
