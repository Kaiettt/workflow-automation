/* eslint-disable @typescript-eslint/no-unsafe-assignment -- expect.objectContaining */
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  findTriggerNodes,
  NewWorkflowTrigger,
  planTriggers,
  TriggerChannel,
  WorkflowTrigger,
} from '@app/triggers/domain/workflow-trigger';
import { buildWebhookItem } from '@app/triggers/domain/webhook-item';
import { WorkflowTriggerRepository } from '@app/triggers/domain/workflow-trigger.repository';
import { WebhookDedupPort } from '@app/triggers/application/ports/webhook-dedup.port';
import {
  ReceiveWebhookCommand,
  ReceiveWebhookHandler,
} from '@app/triggers/application/commands/receive-webhook.command';
import { SyncWorkflowTriggersHandler } from '@app/triggers/application/events/sync-workflow-triggers.handler';
import {
  GetWorkflowTriggersHandler,
  GetWorkflowTriggersQuery,
} from '@app/triggers/application/queries/get-workflow-triggers.query';
import { WorkflowPublishedEvent } from '@app/designer/application/events/workflow-published.event';
import { EnqueueExecutionCommand } from '@app/execution/application/commands/enqueue-execution/enqueue-execution.command';

const definition = (...keys: string[]) => ({
  nodes: keys.map((key, i) => ({ id: `node-${i}`, data: { key } })),
  edges: [],
});

class MemoryTriggerRepository extends WorkflowTriggerRepository {
  rows: WorkflowTrigger[] = [];
  owner: string | null = 'owner-1';
  private seq = 0;

  findActive(channel: TriggerChannel, routingKey: string) {
    return Promise.resolve(
      this.rows.find(
        (r) =>
          r.channel === channel && r.routingKey === routingKey && r.isActive,
      ) ?? null,
    );
  }

  findByWorkflow(workflowId: string) {
    return Promise.resolve(
      this.rows.filter((r) => r.workflowId === workflowId),
    );
  }

  replaceActive(
    workflowId: string,
    workflowVersionId: string,
    triggers: NewWorkflowTrigger[],
  ) {
    for (const row of this.rows) {
      if (row.workflowId === workflowId) row.isActive = false;
    }
    for (const trigger of triggers) {
      this.seq += 1;
      this.rows.push({
        ...trigger,
        id: `trigger-${this.seq}`,
        workflowId,
        workflowVersionId,
        isActive: true,
        createdAt: new Date(Date.UTC(2026, 9, 29, 0, 0, this.seq)),
      });
    }
    return Promise.resolve();
  }

  findWorkflowOwnerId() {
    return Promise.resolve(this.owner);
  }
}

class MemoryDedup extends WebhookDedupPort {
  seen = new Set<string>();
  claim(key: string) {
    if (this.seen.has(key)) return Promise.resolve(false);
    this.seen.add(key);
    return Promise.resolve(true);
  }
}

describe('findTriggerNodes', () => {
  it('returns webhook triggers only (manual triggers need no listener)', () => {
    expect(
      findTriggerNodes(
        definition('trigger.manual', 'trigger.webhook', 'logic.filter'),
      ),
    ).toEqual([
      {
        nodeId: 'node-1',
        triggerKey: 'trigger.webhook',
        channel: TriggerChannel.WEBHOOK,
      },
    ]);
  });

  it('ignores malformed definitions and nodes', () => {
    expect(findTriggerNodes(null)).toEqual([]);
    expect(findTriggerNodes({ nodes: 'x' })).toEqual([]);
    expect(
      findTriggerNodes({ nodes: [null, { id: 1, data: {} }, { data: {} }] }),
    ).toEqual([]);
  });
});

describe('planTriggers', () => {
  const node = {
    nodeId: 'hook',
    triggerKey: 'trigger.webhook',
    channel: TriggerChannel.WEBHOOK,
  };
  const earlier = (routingKey: string, second: number): WorkflowTrigger => ({
    id: routingKey,
    workflowId: 'wf',
    workflowVersionId: 'v',
    nodeId: 'hook',
    triggerKey: 'trigger.webhook',
    channel: TriggerChannel.WEBHOOK,
    routingKey,
    isActive: false,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, second)),
  });

  it('creates a new token the first time', () => {
    expect(planTriggers([node], [], () => 'fresh')).toEqual([
      { ...node, routingKey: 'fresh' },
    ]);
  });

  it('keeps the most recent token of the same node so the URL does not change', () => {
    expect(
      planTriggers([node], [earlier('old', 1), earlier('newer', 2)], () => 'x'),
    ).toEqual([{ ...node, routingKey: 'newer' }]);
  });

  it('generates url-safe tokens of 32 random bytes', () => {
    const [{ routingKey }] = planTriggers([node], []);
    expect(routingKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('buildWebhookItem', () => {
  it('keeps body, query and headers but hides credentials of the caller', () => {
    const item = buildWebhookItem(
      {
        body: { email: 'a@b.c' },
        query: { source: 'form' },
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer secret',
          cookie: 'sid=1',
          'x-api-key': 'k',
          'x-multi': ['a', 'b'],
          'x-none': undefined,
        },
      },
      new Date('2026-10-29T08:00:00.000Z'),
    );

    expect(item).toEqual({
      json: {
        body: { email: 'a@b.c' },
        query: { source: 'form' },
        headers: { 'content-type': 'application/json', 'x-multi': 'a, b' },
        received_at: '2026-10-29T08:00:00.000Z',
      },
    });
  });
});

describe('SyncWorkflowTriggersHandler', () => {
  it('activates the new version and keeps the webhook URL across publishes', async () => {
    const repository = new MemoryTriggerRepository();
    const handler = new SyncWorkflowTriggersHandler(repository);

    await handler.handle(
      new WorkflowPublishedEvent('wf', 'v1', definition('trigger.webhook')),
    );
    const firstToken = repository.rows[0].routingKey;
    await handler.handle(
      new WorkflowPublishedEvent('wf', 'v2', definition('trigger.webhook')),
    );

    const active = repository.rows.filter((r) => r.isActive);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      workflowVersionId: 'v2',
      routingKey: firstToken,
    });
  });

  it('stops listening when the new version has no webhook trigger', async () => {
    const repository = new MemoryTriggerRepository();
    const handler = new SyncWorkflowTriggersHandler(repository);

    await handler.handle(
      new WorkflowPublishedEvent('wf', 'v1', definition('trigger.webhook')),
    );
    await handler.handle(
      new WorkflowPublishedEvent('wf', 'v2', definition('trigger.manual')),
    );

    expect(repository.rows.some((r) => r.isActive)).toBe(false);
  });

  it('does not throw when storing fails (the publish already succeeded)', async () => {
    const repository = new MemoryTriggerRepository();
    jest
      .spyOn(repository, 'replaceActive')
      .mockRejectedValue(new Error('db down'));
    const handler = new SyncWorkflowTriggersHandler(repository);

    await expect(
      handler.handle(
        new WorkflowPublishedEvent('wf', 'v1', definition('trigger.webhook')),
      ),
    ).resolves.toBeUndefined();
  });
});

describe('ReceiveWebhookHandler', () => {
  async function setup() {
    const repository = new MemoryTriggerRepository();
    await repository.replaceActive('wf', 'v1', [
      {
        nodeId: 'hook',
        triggerKey: 'trigger.webhook',
        channel: TriggerChannel.WEBHOOK,
        routingKey: 'token-1',
      },
    ]);
    const commandBus = {
      execute: jest.fn().mockResolvedValue('execution-9'),
    };
    const handler = new ReceiveWebhookHandler(
      repository,
      new MemoryDedup(),
      commandBus as unknown as CommandBus,
    );
    const request = { body: { a: 1 }, query: {}, headers: {} };
    return { handler, commandBus, request };
  }

  it('queues a run of the listening version with the request as its item', async () => {
    const { handler, commandBus, request } = await setup();

    const result = await handler.execute(
      new ReceiveWebhookCommand('token-1', request),
    );

    expect(result).toEqual({ executionId: 'execution-9', duplicate: false });
    const [command] = commandBus.execute.mock.calls[0] as [
      EnqueueExecutionCommand,
    ];
    expect(command).toBeInstanceOf(EnqueueExecutionCommand);
    expect(command.workflowVersionId).toBe('v1');
    expect(command.triggerItems).toEqual([
      { json: expect.objectContaining({ body: { a: 1 } }) },
    ]);
  });

  it('answers 404 for an unknown token', async () => {
    const { handler, request } = await setup();
    await expect(
      handler.execute(new ReceiveWebhookCommand('nope', request)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('starts only one run for repeated calls with the same Idempotency-Key', async () => {
    const { handler, commandBus, request } = await setup();

    const first = await handler.execute(
      new ReceiveWebhookCommand('token-1', request, 'order-42'),
    );
    const second = await handler.execute(
      new ReceiveWebhookCommand('token-1', request, 'order-42'),
    );
    const other = await handler.execute(
      new ReceiveWebhookCommand('token-1', request, 'order-43'),
    );

    expect(first.duplicate).toBe(false);
    expect(second).toEqual({ executionId: null, duplicate: true });
    expect(other.duplicate).toBe(false);
    expect(commandBus.execute).toHaveBeenCalledTimes(2);
  });
});

describe('GetWorkflowTriggersHandler', () => {
  const OLD_ENV = process.env;
  afterEach(() => {
    process.env = OLD_ENV;
  });

  async function setup() {
    const repository = new MemoryTriggerRepository();
    await repository.replaceActive('wf', 'v1', [
      {
        nodeId: 'hook',
        triggerKey: 'trigger.webhook',
        channel: TriggerChannel.WEBHOOK,
        routingKey: 'token-1',
      },
    ]);
    return { repository, handler: new GetWorkflowTriggersHandler(repository) };
  }

  it('builds the webhook URL from PUBLIC_BASE_URL', async () => {
    process.env = { ...OLD_ENV, PUBLIC_BASE_URL: 'https://flow.example.com/' };
    const { handler } = await setup();

    await expect(
      handler.execute(new GetWorkflowTriggersQuery('wf', 'owner-1')),
    ).resolves.toEqual([
      {
        nodeId: 'hook',
        triggerKey: 'trigger.webhook',
        channel: TriggerChannel.WEBHOOK,
        workflowVersionId: 'v1',
        webhookUrl: 'https://flow.example.com/api/webhooks/w/token-1',
      },
    ]);
  });

  it('falls back to the local server address', async () => {
    process.env = { ...OLD_ENV, PUBLIC_BASE_URL: '', PORT: '8081' };
    const { handler } = await setup();

    const [view] = await handler.execute(
      new GetWorkflowTriggersQuery('wf', 'owner-1'),
    );
    expect(view.webhookUrl).toBe(
      'http://localhost:8081/api/webhooks/w/token-1',
    );
  });

  it('refuses other users and unknown workflows', async () => {
    const { repository, handler } = await setup();

    await expect(
      handler.execute(new GetWorkflowTriggersQuery('wf', 'someone-else')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    repository.owner = null;
    await expect(
      handler.execute(new GetWorkflowTriggersQuery('wf', 'owner-1')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
