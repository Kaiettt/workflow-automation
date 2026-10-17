import { IOnceExecutor } from '../../domain/entities/node-executor';
import { NodeKeys } from '../../domain/constants/execution.constants';
import { Item } from '../../domain/models/item';

export class ManualTriggerExecutor implements IOnceExecutor<
  Record<string, never>
> {
  readonly key = NodeKeys.TRIGGER_MANUAL;
  readonly runMode = 'once' as const;

  parseConfig(): Record<string, never> {
    return {};
  }

  // A single empty item starts the flow for the nodes that follow.
  execute(): Promise<Item[]> {
    return Promise.resolve([{ json: {} }]);
  }
}
