import { Item, ItemJson, RoutedItem } from '../models/item';

interface NodeExecutorBase<TConfig> {
  readonly key: string;

  // Receives the config after expressions were resolved.
  parseConfig(raw: unknown): TConfig;
  parseCredential?(raw: unknown): unknown;

  // Connector the node's credential must belong to. Receives the raw config
  // (before expressions), so the field it depends on must not be an expression.
  expectedConnectorKey?(rawConfig: Record<string, unknown>): string | null;
}

// What a per-item node returns for one input item.
export type ItemResult = ItemJson | RoutedItem;

// The engine calls the node once per input item. Returning an object yields one
// item, an array yields several, null or [] drops the item. A RoutedItem sends
// the item to a named output instead of the main one.
export interface IPerItemExecutor<
  TConfig = unknown,
> extends NodeExecutorBase<TConfig> {
  readonly runMode: 'per_item';

  // Most items the node accepts in one run (raw config, before expressions);
  // the engine fails the node up front instead of silently processing a part.
  maxItems?(
    rawConfig: Record<string, unknown>,
  ): { limit: number; reason: string } | null;

  executeItem(params: {
    config: TConfig;
    item: Item;
    credential: unknown;
  }): Promise<ItemResult | ItemResult[] | null>;
}

// The engine calls the node once with every input item.
export interface IOnceExecutor<
  TConfig = unknown,
> extends NodeExecutorBase<TConfig> {
  readonly runMode: 'once';
  execute(params: {
    config: TConfig;
    items: Item[];
    credential: unknown;
  }): Promise<Item[]>;
}

export type INodeExecutor<TConfig = unknown> =
  IPerItemExecutor<TConfig> | IOnceExecutor<TConfig>;
