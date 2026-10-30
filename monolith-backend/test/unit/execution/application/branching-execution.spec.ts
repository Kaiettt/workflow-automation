import {
  ExecutionStatus,
  TriggerType,
} from '@app/execution/domain/constants/execution.constants';
import {
  IOnceExecutor,
  IPerItemExecutor,
} from '@app/execution/domain/entities/node-executor';
import { Item, ItemJson, RoutedItem } from '@app/execution/domain/models/item';
import { WorkflowEngine } from '@app/execution/application/services/workflow-engine';
import { NodeCatalogPort } from '@app/execution/application/ports/node-catalog.port';
import { MemoryExecutionRepository } from '@test/support/execution/start-execution.test-support';

// Emits the items given in its config.
class Source implements IOnceExecutor {
  readonly key = 'test.source';
  readonly runMode = 'once' as const;
  parseConfig(raw: unknown) {
    return raw;
  }
  execute({ config }: { config: unknown }) {
    const { items } = config as { items: ItemJson[] };
    return Promise.resolve(items.map((json) => ({ json })));
  }
}

// Sends each item to output "big" or "small" by its n.
class Route implements IPerItemExecutor {
  readonly key = 'test.route';
  readonly runMode = 'per_item' as const;
  parseConfig(raw: unknown) {
    return raw;
  }
  executeItem({ item }: { item: Item }) {
    return Promise.resolve(
      new RoutedItem(Number(item.json.n) > 10 ? 'big' : 'small', item.json),
    );
  }
}

// Adds { tag } to every item, with the tag taken from the config.
class Tag implements IPerItemExecutor {
  readonly key = 'test.tag';
  readonly runMode = 'per_item' as const;
  parseConfig(raw: unknown) {
    return raw;
  }
  executeItem({ item, config }: { item: Item; config: unknown }) {
    const { tag, from } = config as { tag: string; from?: unknown };
    return Promise.resolve({
      ...item.json,
      tag,
      ...(from === undefined ? {} : { from }),
    });
  }
}

class Failing implements IPerItemExecutor {
  readonly key = 'test.fail';
  readonly runMode = 'per_item' as const;
  parseConfig(raw: unknown) {
    return raw;
  }
  executeItem(): Promise<ItemJson> {
    return Promise.reject(new Error('boom'));
  }
}

// Bad executor: routes to an output the node does not have.
class Misroute implements IPerItemExecutor {
  readonly key = 'test.misroute';
  readonly runMode = 'per_item' as const;
  parseConfig(raw: unknown) {
    return raw;
  }
  executeItem() {
    return Promise.resolve(new RoutedItem('nope', {}));
  }
}

const OUTPUTS = {
  'x-outputs': {
    static: [
      { key: 'big', label: 'Big' },
      { key: 'small', label: 'Small' },
    ],
  },
};
const TAG_SCHEMA = {
  type: 'object',
  properties: { from: { 'x-allowExpression': true } },
};

class Catalog extends NodeCatalogPort {
  getConfigSchemas(): Promise<Map<string, unknown>> {
    return Promise.resolve(
      new Map<string, unknown>([
        ['test.route', OUTPUTS],
        ['test.misroute', OUTPUTS],
        ['test.tag', TAG_SCHEMA],
      ]),
    );
  }
}

const node = (id: string, key: string, config: unknown = {}) => ({
  id,
  data: { key, name: id, config },
});
const edge = (source: string, target: string, handle?: string) => ({
  source,
  target,
  sourceHandle: handle ? `out:${handle}` : undefined,
});

async function run(nodes: unknown[], edges: unknown[]) {
  const repository = new MemoryExecutionRepository({
    id: 'v',
    workflowId: 'w',
    workflowOwnerId: 'actor-1',
    definition: { nodes, edges },
  });
  const engine = new WorkflowEngine(
    repository,
    [new Source(), new Route(), new Tag(), new Failing(), new Misroute()],
    new Catalog(),
  );
  const startedAt = new Date();
  const executionId = await engine.createExecution(
    {
      version: {
        id: 'v',
        workflowId: 'w',
        workflowOwnerId: 'actor-1',
        definition: { nodes, edges },
      },
      triggerType: TriggerType.MANUAL,
      triggeredById: 'actor-1',
      triggerItems: [],
    },
    startedAt,
  );
  const status = await engine.run(
    executionId,
    {
      id: 'v',
      workflowId: 'w',
      workflowOwnerId: 'actor-1',
      definition: { nodes, edges },
    },
    [],
    startedAt,
  );
  const log = (id: string) => repository.logs.find((l) => l.nodeId === id);
  const out = (id: string) =>
    ((log(id)?.output ?? []) as Item[]).map((item) => item.json);
  return { status, repository, log, out };
}

const source = node('src', 'test.source', {
  items: [{ n: 1 }, { n: 50 }, { n: 2 }, { n: 99 }],
});

describe('WorkflowEngine on a graph', () => {
  it('sends each item down the branch its output names and skips the other', async () => {
    const { status, out, log } = await run(
      [
        source,
        node('route', 'test.route'),
        node('onBig', 'test.tag', { tag: 'big' }),
        node('onSmall', 'test.tag', { tag: 'small' }),
      ],
      [
        edge('src', 'route'),
        edge('route', 'onBig', 'big'),
        edge('route', 'onSmall', 'small'),
      ],
    );

    expect(status).toBe(ExecutionStatus.SUCCESS);
    expect(out('onBig')).toEqual([
      { n: 50, tag: 'big' },
      { n: 99, tag: 'big' },
    ]);
    expect(out('onSmall')).toEqual([
      { n: 1, tag: 'small' },
      { n: 2, tag: 'small' },
    ]);
    expect(log('onBig')?.status).toBe(ExecutionStatus.SUCCESS);
  });

  it('skips a node whose output got no items, and everything after it', async () => {
    const { status, log, repository } = await run(
      [
        node('src', 'test.source', { items: [{ n: 1 }] }),
        node('route', 'test.route'),
        node('onBig', 'test.tag', { tag: 'big' }),
        node('afterBig', 'test.tag', { tag: 'after' }),
        node('onSmall', 'test.tag', { tag: 'small' }),
      ],
      [
        edge('src', 'route'),
        edge('route', 'onBig', 'big'),
        edge('onBig', 'afterBig'),
        edge('route', 'onSmall', 'small'),
      ],
    );

    expect(status).toBe(ExecutionStatus.SUCCESS);
    expect(log('onBig')?.status).toBe('SKIPPED');
    expect(log('afterBig')?.status).toBe('SKIPPED');
    expect(log('onSmall')?.status).toBe(ExecutionStatus.SUCCESS);
    expect(repository.finishedStatus).toBe(ExecutionStatus.SUCCESS);
  });

  it('runs a joining node once with the items of the branches that ran', async () => {
    const { out, log } = await run(
      [
        source,
        node('route', 'test.route'),
        node('onBig', 'test.tag', { tag: 'big' }),
        node('onSmall', 'test.tag', { tag: 'small' }),
        node('join', 'test.tag', { tag: 'joined' }),
      ],
      [
        edge('src', 'route'),
        edge('route', 'onBig', 'big'),
        edge('route', 'onSmall', 'small'),
        edge('onBig', 'join'),
        edge('onSmall', 'join'),
      ],
    );

    expect(log('join')?.status).toBe(ExecutionStatus.SUCCESS);
    expect(out('join').map((json) => json.n)).toEqual([50, 99, 1, 2]);
  });

  it('runs a joining node when only one of its branches ran', async () => {
    const { out } = await run(
      [
        node('src', 'test.source', { items: [{ n: 1 }] }),
        node('route', 'test.route'),
        node('onBig', 'test.tag', { tag: 'big' }),
        node('onSmall', 'test.tag', { tag: 'small' }),
        node('join', 'test.tag', { tag: 'joined' }),
      ],
      [
        edge('src', 'route'),
        edge('route', 'onBig', 'big'),
        edge('route', 'onSmall', 'small'),
        edge('onBig', 'join'),
        edge('onSmall', 'join'),
      ],
    );

    expect(out('join')).toEqual([{ n: 1, tag: 'joined' }]);
  });

  it('runs both targets when one output fans out to two nodes', async () => {
    const { out } = await run(
      [
        node('src', 'test.source', { items: [{ n: 7 }] }),
        node('a', 'test.tag', { tag: 'a' }),
        node('b', 'test.tag', { tag: 'b' }),
      ],
      [edge('src', 'a'), edge('src', 'b')],
    );

    expect(out('a')).toEqual([{ n: 7, tag: 'a' }]);
    expect(out('b')).toEqual([{ n: 7, tag: 'b' }]);
  });

  it('pairs items through a branch with $node[...]', async () => {
    const { out } = await run(
      [
        source,
        node('route', 'test.route'),
        node('onBig', 'test.tag', { tag: 'big' }),
        // Reads n of the source item that produced the current one.
        node('after', 'test.tag', {
          tag: 'after',
          from: '{{$node["src"].json.n}}',
        }),
      ],
      [
        edge('src', 'route'),
        edge('route', 'onBig', 'big'),
        edge('onBig', 'after'),
      ],
    );

    expect(out('after')).toEqual([
      { n: 50, tag: 'after', from: 50 },
      { n: 99, tag: 'after', from: 99 },
    ]);
  });

  it('pairs items of the right branch after a join', async () => {
    const { out } = await run(
      [
        source,
        node('route', 'test.route'),
        node('onBig', 'test.tag', { tag: 'big' }),
        node('onSmall', 'test.tag', { tag: 'small' }),
        node('join', 'test.tag', {
          tag: 'joined',
          from: '{{$node["src"].json.n}}',
        }),
      ],
      [
        edge('src', 'route'),
        edge('route', 'onBig', 'big'),
        edge('route', 'onSmall', 'small'),
        edge('onBig', 'join'),
        edge('onSmall', 'join'),
      ],
    );

    expect(out('join').map((json) => json.from)).toEqual([50, 99, 1, 2]);
  });

  it('fails the node that reads a node on a branch that did not run', async () => {
    const { status, log } = await run(
      [
        node('src', 'test.source', { items: [{ n: 1 }] }),
        node('route', 'test.route'),
        node('onBig', 'test.tag', { tag: 'big' }),
        node('onSmall', 'test.tag', {
          tag: 'small',
          from: '{{$node["onBig"].json.tag}}',
        }),
      ],
      [
        edge('src', 'route'),
        edge('route', 'onBig', 'big'),
        edge('route', 'onSmall', 'small'),
      ],
    );

    expect(status).toBe(ExecutionStatus.FAILED);
    expect(log('onSmall')?.errorMessage).toContain('has not run before');
  });

  it('fails the node that returns an item for an unknown output', async () => {
    const { status, log } = await run(
      [
        node('src', 'test.source', { items: [{ n: 1 }] }),
        node('bad', 'test.misroute'),
        node('next', 'test.tag', { tag: 'x' }),
      ],
      [edge('src', 'bad'), edge('bad', 'next', 'big')],
    );

    expect(status).toBe(ExecutionStatus.FAILED);
    expect(log('bad')?.errorMessage).toContain('unknown output "nope"');
    expect(log('next')).toBeUndefined();
  });

  it('stops at a failing node on a branch', async () => {
    const { status, log } = await run(
      [
        node('src', 'test.source', { items: [{ n: 1 }] }),
        node('boom', 'test.fail'),
        node('next', 'test.tag', { tag: 'x' }),
      ],
      [edge('src', 'boom'), edge('boom', 'next')],
    );

    expect(status).toBe(ExecutionStatus.FAILED);
    expect(log('next')).toBeUndefined();
  });

  it('keeps running a main output that is empty', async () => {
    const { status, log, out } = await run(
      [
        node('src', 'test.source', { items: [] }),
        node('after', 'test.tag', { tag: 'x' }),
      ],
      [edge('src', 'after')],
    );

    expect(status).toBe(ExecutionStatus.SUCCESS);
    expect(log('after')?.status).toBe(ExecutionStatus.SUCCESS);
    expect(out('after')).toEqual([]);
  });
});
