import { INodeExecutor } from '../../domain/entities/node-executor';
import { NodeKeys } from '../../domain/constants/execution.constants';

export class ManualTriggerExecutor implements INodeExecutor<
  Record<string, never>,
  null,
  null
> {
  readonly key = NodeKeys.TRIGGER_MANUAL;

  parseConfig(): Record<string, never> {
    return {};
  }

  parseInput(): null {
    return null;
  }

  execute(): Promise<null> {
    return Promise.resolve(null);
  }
}
