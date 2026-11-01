import { IOnceExecutor } from '../../domain/entities/node-executor';
import { Item } from '../../domain/models/item';

// Triggers fed by an outside event (webhook, Messenger message): the event is
// already the execution input, so it is passed on unchanged.
export class PassThroughTriggerExecutor implements IOnceExecutor<
  Record<string, never>
> {
  readonly runMode = 'once' as const;

  constructor(readonly key: string) {}

  parseConfig(): Record<string, never> {
    return {};
  }

  // A run without a payload (e.g. pressed by hand) still starts the flow.
  execute({ items }: { items: Item[] }): Promise<Item[]> {
    return Promise.resolve(items.length > 0 ? items : [{ json: {} }]);
  }
}
