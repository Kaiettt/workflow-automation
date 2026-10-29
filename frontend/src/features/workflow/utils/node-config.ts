// Pure helpers for node configuration; kept free of React so they are easy to reason about.

interface SchemaProperty {
  default?: unknown;
}

function schemaProperties(configSchema: unknown): Record<string, SchemaProperty> {
  if (typeof configSchema !== 'object' || configSchema === null) return {};
  const properties = (configSchema as { properties?: unknown }).properties;
  if (typeof properties !== 'object' || properties === null) return {};
  return properties as Record<string, SchemaProperty>;
}

// Config a freshly added node starts with: the `default` declared by each schema property.
export function getDefaultConfig(configSchema: unknown): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const [key, property] of Object.entries(schemaProperties(configSchema))) {
    if (property && property.default !== undefined) {
      config[key] = property.default;
    }
  }
  return config;
}

// "Send Gmail" -> "Send Gmail 2" -> "Send Gmail 3" ... so $node["name"] stays unambiguous.
export function uniqueNodeName(baseName: string, existingNames: string[]): string {
  const taken = new Set(existingNames);
  if (!taken.has(baseName)) return baseName;
  let suffix = 2;
  while (taken.has(`${baseName} ${suffix}`)) suffix += 1;
  return `${baseName} ${suffix}`;
}

interface NamedNode {
  id: string;
  data?: { name?: unknown };
}

export function isDuplicateNodeName(
  nodes: NamedNode[],
  nodeId: string,
  name: string,
): boolean {
  return nodes.some((node) => node.id !== nodeId && node.data?.name === name);
}

// Number of items when a log payload is a list of items, otherwise null.
export function countItems(payload: unknown): number | null {
  return Array.isArray(payload) ? payload.length : null;
}

export type PropertySchema = Record<string, unknown>;

export function getProperties(configSchema: unknown): Record<string, PropertySchema> {
  return schemaProperties(configSchema) as Record<string, PropertySchema>;
}

// Label of a config field: the schema `title`, else the key without underscores.
export function propertyTitle(key: string, property: PropertySchema): string {
  return typeof property.title === 'string' ? property.title : key.replace(/_/g, ' ');
}

// Fields whose options depend on `changedKey` (x-connectorKeyFrom); they must be
// cleared when it changes, e.g. a credential picked for one provider.
export function dependentKeys(configSchema: unknown, changedKey: string): string[] {
  return Object.entries(getProperties(configSchema))
    .filter(([, property]) => property['x-connectorKeyFrom'] === changedKey)
    .map(([key]) => key);
}

// x-placeholder, or x-placeholderByField: { field, values } -> the hint for the
// current value of `field`.
export function placeholderFor(
  property: PropertySchema,
  config: Record<string, unknown>,
): string | undefined {
  if (typeof property['x-placeholder'] === 'string') return property['x-placeholder'];
  const rule = property['x-placeholderByField'];
  if (typeof rule !== 'object' || rule === null) return undefined;
  const { field, values } = rule as { field?: unknown; values?: unknown };
  if (typeof field !== 'string' || typeof values !== 'object' || values === null) {
    return undefined;
  }
  const hint = (values as Record<string, unknown>)[String(config[field] ?? '')];
  return typeof hint === 'string' ? hint : undefined;
}

// Text typed into a number box: empty or not a number means "not set".
export function parseNumberInput(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

// Fields in display order. The database does not keep the order properties were
// written in (JSONB reorders keys), so a schema lists it in `x-propertyOrder`;
// fields it does not mention follow in their stored order.
export function orderedProperties(configSchema: unknown): Array<[string, PropertySchema]> {
  const properties = getProperties(configSchema);
  const declared =
    typeof configSchema === 'object' && configSchema !== null
      ? (configSchema as { 'x-propertyOrder'?: unknown })['x-propertyOrder']
      : undefined;
  const preferred = Array.isArray(declared)
    ? declared.filter((key): key is string => typeof key === 'string' && key in properties)
    : [];
  const rest = Object.keys(properties).filter((key) => !preferred.includes(key));
  return [...preferred, ...rest].map((key) => [key, properties[key]]);
}
