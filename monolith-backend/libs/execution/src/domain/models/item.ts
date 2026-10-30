export type ItemJson = Record<string, unknown>;

export interface Item {
  json: ItemJson;
  // Index of the input item that produced this item; assigned by the engine for per_item nodes.
  pairedItem?: number;
}

// An item sent to one named output of a node (IF: "true" / "false", Switch:
// one per rule). Plain items go to the main output.
export class RoutedItem {
  constructor(
    readonly output: string,
    readonly json: ItemJson,
  ) {}
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
