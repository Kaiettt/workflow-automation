/* eslint-disable @typescript-eslint/unbound-method */
import {
  NodeRunner,
  NodeRunParams,
} from '@app/execution/application/services/node-runner';
import { NodeConfigResolver } from '@app/execution/application/services/node-config-resolver';
import { NodeExecutionObserver } from '@app/execution/application/services/node-execution-observer';
import { OnceExecutionStrategy } from '@app/execution/application/services/strategies/once-execution.strategy';
import { PerItemExecutionStrategy } from '@app/execution/application/services/strategies/per-item-execution.strategy';
import {
  IOnceExecutor,
  IPerItemExecutor,
} from '@app/execution/domain/entities/node-executor';
import { ExecutionStatus } from '@app/execution/domain/constants/execution.constants';

describe('NodeRunner', () => {
  let resolver: jest.Mocked<NodeConfigResolver>;
  let observer: jest.Mocked<NodeExecutionObserver>;
  let onceStrategy: jest.Mocked<OnceExecutionStrategy>;
  let perItemStrategy: jest.Mocked<PerItemExecutionStrategy>;

  const mockNode = {
    id: 'n-1',
    data: { key: 'sample.key', name: 'Sample Node', config: { foo: 'bar' } },
  };

  const mockParams: NodeRunParams = {
    node: mockNode,
    workflowId: 'wf-1',
    executionId: 'exec-1',
    items: [{ json: { a: 1 } }],
    runs: [],
    names: new Map(),
    configSchema: {},
    credentialOwnerId: 'user-1',
  };

  beforeEach(() => {
    resolver = {
      applyDefaults: jest.fn((cfg) => cfg as Record<string, unknown>),
      resolveCredential: jest.fn(),
      resolveItemConfig: jest.fn(),
    } as unknown as jest.Mocked<NodeConfigResolver>;

    observer = {
      notifyStarted: jest.fn().mockResolvedValue(undefined),
      notifyCompleted: jest.fn().mockResolvedValue({
        log: {
          nodeId: 'n-1',
          nodeKey: 'sample.key',
          status: ExecutionStatus.SUCCESS,
          input: mockParams.items,
          output: [{ json: { out: true } }],
          startedAt: new Date(),
          finishedAt: new Date(),
        },
        output: [{ json: { out: true } }],
        outputs: new Map([['main', [{ json: { out: true } }]]]),
        status: ExecutionStatus.SUCCESS,
      }),
      notifyFailed: jest.fn().mockResolvedValue({
        log: {
          nodeId: 'n-1',
          nodeKey: 'sample.key',
          status: ExecutionStatus.FAILED,
          input: mockParams.items,
          output: null,
          errorMessage: 'Boom',
          startedAt: new Date(),
          finishedAt: new Date(),
        },
        output: [],
        outputs: new Map(),
        status: ExecutionStatus.FAILED,
      }),
      notifySkipped: jest.fn(),
    } as unknown as jest.Mocked<NodeExecutionObserver>;

    onceStrategy = {
      execute: jest
        .fn()
        .mockResolvedValue(new Map([['main', [{ json: { out: true } }]]])),
    } as unknown as jest.Mocked<OnceExecutionStrategy>;

    perItemStrategy = {
      execute: jest
        .fn()
        .mockResolvedValue(new Map([['main', [{ json: { out: true } }]]])),
    } as unknown as jest.Mocked<PerItemExecutionStrategy>;
  });

  it('fails and notifies observer when executor is not registered', async () => {
    const runner = new NodeRunner(
      resolver,
      observer,
      onceStrategy,
      perItemStrategy,
      new Map(),
    );

    const result = await runner.run(mockParams);

    expect(observer.notifyStarted).toHaveBeenCalled();
    expect(observer.notifyFailed).toHaveBeenCalledWith(
      mockParams,
      expect.objectContaining({
        message: 'No executor registered for node key: sample.key',
      }),
      expect.any(Date),
      expect.any(Date),
    );
    expect(result.status).toBe(ExecutionStatus.FAILED);
  });

  it('delegates once nodes to OnceExecutionStrategy and completes', async () => {
    const onceExecutor: IOnceExecutor = {
      key: 'sample.key',
      runMode: 'once',
      parseConfig: jest.fn((c) => c),
      execute: jest.fn(),
    };

    const runner = new NodeRunner(
      resolver,
      observer,
      onceStrategy,
      perItemStrategy,
      new Map([['sample.key', onceExecutor]]),
    );

    const result = await runner.run(mockParams);

    expect(observer.notifyStarted).toHaveBeenCalled();
    expect(resolver.applyDefaults).toHaveBeenCalledWith({ foo: 'bar' }, {});
    expect(onceStrategy.execute).toHaveBeenCalledWith(
      onceExecutor,
      { foo: 'bar' },
      mockParams,
    );
    expect(observer.notifyCompleted).toHaveBeenCalled();
    expect(result.status).toBe(ExecutionStatus.SUCCESS);
  });

  it('delegates per_item nodes to PerItemExecutionStrategy and completes', async () => {
    const perItemExecutor: IPerItemExecutor = {
      key: 'sample.key',
      runMode: 'per_item',
      parseConfig: jest.fn((c) => c),
      executeItem: jest.fn(),
    };

    const runner = new NodeRunner(
      resolver,
      observer,
      onceStrategy,
      perItemStrategy,
      new Map([['sample.key', perItemExecutor]]),
    );

    const result = await runner.run(mockParams);

    expect(observer.notifyStarted).toHaveBeenCalled();
    expect(perItemStrategy.execute).toHaveBeenCalledWith(
      perItemExecutor,
      { foo: 'bar' },
      mockParams,
    );
    expect(observer.notifyCompleted).toHaveBeenCalled();
    expect(result.status).toBe(ExecutionStatus.SUCCESS);
  });

  it('handles strategy execution error by notifying observer failed', async () => {
    const onceExecutor: IOnceExecutor = {
      key: 'sample.key',
      runMode: 'once',
      parseConfig: jest.fn((c) => c),
      execute: jest.fn(),
    };

    onceStrategy.execute.mockRejectedValue(new Error('Strategy crashed'));

    const runner = new NodeRunner(
      resolver,
      observer,
      onceStrategy,
      perItemStrategy,
      new Map([['sample.key', onceExecutor]]),
    );

    const result = await runner.run(mockParams);

    expect(observer.notifyFailed).toHaveBeenCalledWith(
      mockParams,
      expect.objectContaining({ message: 'Strategy crashed' }),
      expect.any(Date),
      expect.any(Date),
    );
    expect(result.status).toBe(ExecutionStatus.FAILED);
  });
});
