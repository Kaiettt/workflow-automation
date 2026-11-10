/* eslint-disable @typescript-eslint/unbound-method */
import { OnceExecutionStrategy } from '@app/execution/application/services/strategies/once-execution.strategy';
import { PerItemExecutionStrategy } from '@app/execution/application/services/strategies/per-item-execution.strategy';
import { NodeConfigResolver } from '@app/execution/application/services/node-config-resolver';
import {
  IOnceExecutor,
  IPerItemExecutor,
} from '@app/execution/domain/entities/node-executor';
import { ItemRunError } from '@app/execution/application/services/node-execution-observer';
import { RoutedItem } from '@app/execution/domain/models/item';
import { NodeRunParams } from '@app/execution/application/services/node-runner';

describe('Execution Strategies', () => {
  let configResolver: jest.Mocked<NodeConfigResolver>;
  let onceStrategy: OnceExecutionStrategy;
  let perItemStrategy: PerItemExecutionStrategy;

  const mockNode = {
    id: 'n-1',
    data: { key: 'test.node', name: 'Node' },
  };

  const createParams = (
    items: Array<{ json: Record<string, unknown> }>,
  ): NodeRunParams => ({
    node: mockNode,
    workflowId: 'w-1',
    executionId: 'e-1',
    items,
    runs: [],
    names: new Map(),
    configSchema: {},
    credentialOwnerId: 'owner-1',
  });

  beforeEach(() => {
    configResolver = {
      resolveCredential: jest.fn().mockResolvedValue(null),
      resolveItemConfig: jest.fn((_, raw: unknown): unknown => raw),
      applyDefaults: jest.fn((c: unknown): Record<string, unknown> =>
        typeof c === 'object' && c !== null
          ? (c as Record<string, unknown>)
          : {},
      ),
    } as unknown as jest.Mocked<NodeConfigResolver>;

    onceStrategy = new OnceExecutionStrategy(configResolver);
    perItemStrategy = new PerItemExecutionStrategy(configResolver);
  });

  describe('OnceExecutionStrategy', () => {
    it('executes executor once and returns items mapped to main output', async () => {
      const executor: IOnceExecutor = {
        key: 'test.once',
        runMode: 'once',
        parseConfig: jest.fn((c) => c),
        execute: jest.fn().mockResolvedValue([{ json: { total: 100 } }]),
      };

      const params = createParams([{ json: { a: 1 } }, { json: { a: 2 } }]);
      const result = await onceStrategy.execute(
        executor,
        { limit: 10 },
        params,
      );

      expect(result.get('main')).toEqual([{ json: { total: 100 } }]);
      expect(executor.execute).toHaveBeenCalledWith({
        config: { limit: 10 },
        items: params.items,
        credential: null,
      });
    });

    it('throws if executor output is not an array of plain items', async () => {
      const executor: IOnceExecutor = {
        key: 'test.once',
        runMode: 'once',
        parseConfig: jest.fn((c) => c),
        execute: jest.fn().mockResolvedValue('not-an-array'),
      };

      await expect(
        onceStrategy.execute(executor, {}, createParams([])),
      ).rejects.toThrow('Node returned an invalid list of items');
    });
  });

  describe('PerItemExecutionStrategy', () => {
    it('returns empty outputs immediately when input items are empty', async () => {
      const executor: IPerItemExecutor = {
        key: 'test.per_item',
        runMode: 'per_item',
        parseConfig: jest.fn((c) => c),
        executeItem: jest.fn(),
      };

      const result = await perItemStrategy.execute(
        executor,
        {},
        createParams([]),
      );
      expect(result.get('main')).toEqual([]);
      expect(executor.executeItem).not.toHaveBeenCalled();
    });

    it('enforces maxItems cap when limit is exceeded', async () => {
      const executor: IPerItemExecutor = {
        key: 'test.per_item',
        runMode: 'per_item',
        parseConfig: jest.fn((c) => c),
        executeItem: jest.fn(),
        maxItems: () => ({ limit: 2, reason: 'the 2 item maximum cap' }),
      };

      const params = createParams([
        { json: { id: 1 } },
        { json: { id: 2 } },
        { json: { id: 3 } },
      ]);

      await expect(
        perItemStrategy.execute(executor, {}, params),
      ).rejects.toThrow(
        'Node received 3 items, which exceeds the 2 item maximum cap',
      );
    });

    it('processes each item and routes RoutedItem to specific outputs', async () => {
      const executor: IPerItemExecutor = {
        key: 'test.per_item',
        runMode: 'per_item',
        parseConfig: jest.fn((c) => c),
        executeItem: jest
          .fn()
          .mockResolvedValueOnce(new RoutedItem('true', { passed: true }))
          .mockResolvedValueOnce(new RoutedItem('false', { passed: false })),
      };

      const params = {
        ...createParams([{ json: { val: 1 } }, { json: { val: 2 } }]),
        outputKeys: ['true', 'false'],
      };

      const result = await perItemStrategy.execute(executor, {}, params);

      expect(result.get('true')).toEqual([
        { json: { passed: true }, pairedItem: 0 },
      ]);
      expect(result.get('false')).toEqual([
        { json: { passed: false }, pairedItem: 1 },
      ]);
    });

    it('wraps item failure in ItemRunError with progress summary', async () => {
      const executor: IPerItemExecutor = {
        key: 'test.per_item',
        runMode: 'per_item',
        parseConfig: jest.fn((c) => c),
        executeItem: jest
          .fn()
          .mockResolvedValueOnce({ processed: 0 })
          .mockRejectedValueOnce(new Error('Network timeout')),
      };

      const params = createParams([
        { json: { val: 0 } },
        { json: { val: 1 } },
        { json: { val: 2 } },
      ]);

      let caughtError: unknown;
      try {
        await perItemStrategy.execute(executor, {}, params);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ItemRunError);
      const itemError = caughtError as ItemRunError;
      expect(itemError.message).toBe('Network timeout');
      expect(itemError.summary).toEqual({
        total_items: 3,
        processed: 1,
        failed_at_index: 1,
      });
    });
  });
});
