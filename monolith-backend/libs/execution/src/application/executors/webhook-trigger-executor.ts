import { IOnceExecutor } from '../../domain/entities/node-executor';
import { NodeKeys } from '../../domain/constants/execution.constants';
import { Item } from '../../domain/models/item';

export class WebhookTriggerExecutor implements IOnceExecutor<
  Record<string, never>
> {
  readonly key = NodeKeys.TRIGGER_WEBHOOK;
  readonly runMode = 'once' as const;

  parseConfig(): Record<string, never> {
    return {};
  }

  // The received request is already the execution input; pass it on. A run
  // without a payload (e.g. pressed by hand) still starts the flow.
  execute({ items }: { items: Item[] }): Promise<Item[]> {
    return Promise.resolve(items.length > 0 ? items : [{ json: {} }]);
  }
}
