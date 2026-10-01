import { INodeExecutor } from './node-executor';

export class ManualTriggerExecutor implements INodeExecutor<
  Record<string, never>,
  null,
  null
> {
  readonly key = 'trigger.manual';

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
