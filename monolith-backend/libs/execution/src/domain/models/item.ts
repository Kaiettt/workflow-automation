export type ItemJson = Record<string, unknown>;

export interface Item {
  json: ItemJson;
  // Index of the input item that produced this item; assigned by the engine for per_item nodes.
  pairedItem?: number;
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
