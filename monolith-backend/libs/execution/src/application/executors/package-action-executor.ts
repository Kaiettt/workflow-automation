import {
  ActionNode,
  AppApiError,
  nodeParameters,
  PackageRegistry,
} from '@app/apps';
import {
  INodeExecutor,
  IPerItemExecutor,
} from '../../domain/entities/node-executor';
import { PassThroughTriggerExecutor } from './pass-through-trigger-executor';
import { PackageActionLimits } from '../../domain/constants/execution.constants';
import { Item, ItemJson } from '../../domain/models/item';
import { Sleep } from './llm-generate-executor';

type Parameters = Record<string, unknown>;

const defaultSleep: Sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Runs an action node of an integration package for each item: the engine
// resolves expressions and the credential, the package talks to the app.
export class PackageActionExecutor implements IPerItemExecutor<Parameters> {
  readonly runMode = 'per_item' as const;
  readonly key: string;

  constructor(
    private readonly node: ActionNode,
    private readonly sleep: Sleep = defaultSleep,
  ) {
    this.key = node.key;
  }

  // Required fields must not resolve to blank (e.g. an expression whose
  // field is missing in the item).
  parseConfig(raw: unknown): Parameters {
    const parameters = nodeParameters(raw);
    for (const property of this.node.properties) {
      if (!property.required) continue;
      const value = parameters[property.name];
      if (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '')
      ) {
        throw new Error(`${property.displayName} is required`);
      }
    }
    return parameters;
  }

  expectedConnectorKey(): string | null {
    return this.node.credentialType ?? null;
  }

  async executeItem(params: {
    config: Parameters;
    item: Item;
    credential: unknown;
  }): Promise<ItemJson | ItemJson[] | null> {
    const credential =
      params.credential && typeof params.credential === 'object'
        ? (params.credential as Record<string, unknown>)
        : null;
    if (this.node.credentialType && !credential) {
      throw new Error('Choose a credential for this node');
    }
    return this.withRetry(() =>
      this.node.execute({
        parameters: params.config,
        credential,
        item: { json: params.item.json },
      }),
    );
  }

  // Rate limits and outages are retried with a growing pause; anything else
  // (e.g. Messenger's 24-hour window, revoked access) fails at once.
  private async withRetry<T>(attempt: () => Promise<T>): Promise<T> {
    for (let retry = 0; ; retry += 1) {
      try {
        return await attempt();
      } catch (error) {
        const retryable = error instanceof AppApiError && error.retryable;
        if (!retryable || retry >= PackageActionLimits.MAX_RETRIES) throw error;
        await this.sleep(1000 * 2 ** retry);
      }
    }
  }
}

// Executors of every package node: a trigger passes its event on (the event
// is the run's input), an action runs per item.
export function packageExecutors(registry: PackageRegistry): INodeExecutor[] {
  return registry
    .allNodes()
    .map((node) =>
      node.kind === 'action'
        ? new PackageActionExecutor(node)
        : new PassThroughTriggerExecutor(node.key),
    );
}
