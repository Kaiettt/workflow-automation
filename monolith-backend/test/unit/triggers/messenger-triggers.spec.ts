import { createHmac } from 'node:crypto';
import { CommandBus } from '@nestjs/cqrs';
import {
  isValidMetaSignature,
  parseMessengerMessages,
} from '@app/triggers/domain/messenger-event';
import {
  findTriggerNodes,
  TriggerChannel,
} from '@app/triggers/domain/workflow-trigger';
import { SyncWorkflowTriggersHandler } from '@app/triggers/application/events/sync-workflow-triggers.handler';
import { CheckPublishTriggersHandler } from '@app/triggers/application/queries/check-publish-triggers.handler';
import {
  ReceiveMessengerEventsCommand,
  ReceiveMessengerEventsHandler,
} from '@app/triggers/application/commands/receive-messenger-events.command';
import { CheckPublishTriggersQuery } from '@app/designer/application/queries/check-publish-triggers.query';
import { WorkflowPublishedEvent } from '@app/designer/application/events/workflow-published.event';
import { EnqueueExecutionCommand } from '@app/execution/application/commands/enqueue-execution/enqueue-execution.command';
import {
  LLM_CREDENTIAL_ID,
  MemoryDedup,
  MemoryTriggerRepository,
  OTHER_PAGE_CREDENTIAL_ID,
  PAGE_CREDENTIAL_ID,
} from '@test/support/triggers/memory-triggers';

const messengerTrigger = (credentialId: string, id = 'chat') => ({
  id,
  data: {
    key: 'trigger.messenger.message',
    config: { credential_id: credentialId },
  },
});
const definition = (...nodes: unknown[]) => ({ nodes, edges: [] });

const textEvent = (overrides: Record<string, unknown> = {}) => ({
  sender: { id: 'customer-1' },
  recipient: { id: 'page-1' },
  timestamp: Date.UTC(2026, 9, 29, 8, 0, 0),
  message: { mid: 'm_1', text: 'Còn size M không shop?' },
  ...overrides,
});
const pageBody = (pageId: string, ...messaging: unknown[]) => ({
  object: 'page',
  entry: [{ id: pageId, time: 1, messaging }],
});

describe('isValidMetaSignature', () => {
  const secret = 'app-secret';
  const body = Buffer.from(JSON.stringify(pageBody('page-1', textEvent())));
  const sign = (bytes: Buffer, key = secret) =>
    `sha256=${createHmac('sha256', key).update(bytes).digest('hex')}`;

  it('accepts the HMAC-SHA256 of the exact body', () => {
    expect(isValidMetaSignature(body, sign(body), secret)).toBe(true);
  });

  it('rejects a changed body, another secret, a missing header or secret', () => {
    const tampered = Buffer.from(body.toString().replace('M', 'L'));
    expect(isValidMetaSignature(tampered, sign(body), secret)).toBe(false);
    expect(isValidMetaSignature(body, sign(body, 'other'), secret)).toBe(false);
    expect(isValidMetaSignature(body, undefined, secret)).toBe(false);
    expect(isValidMetaSignature(body, sign(body), undefined)).toBe(false);
    expect(isValidMetaSignature(undefined, sign(body), secret)).toBe(false);
    expect(isValidMetaSignature(body, 'sha256=short', secret)).toBe(false);
  });
});

describe('parseMessengerMessages', () => {
  it('turns each customer message into an item', () => {
    const [message] = parseMessengerMessages(
      pageBody(
        'page-1',
        textEvent({
          message: {
            mid: 'm_1',
            text: 'Ảnh đây',
            attachments: [
              { type: 'image', payload: { url: 'https://x/y.jpg' } },
            ],
          },
        }),
      ),
    );

    expect(message.pageId).toBe('page-1');
    expect(message.messageId).toBe('m_1');
    expect(message.item.json).toEqual(
      expect.objectContaining({
        channel: 'messenger',
        message_id: 'm_1',
        sender_id: 'customer-1',
        recipient_id: 'page-1',
        text: 'Ảnh đây',
        attachments: [{ type: 'image', url: 'https://x/y.jpg' }],
        timestamp: '2026-10-29T08:00:00.000Z',
      }),
    );
  });

  it('drops echoes of the Page own messages, deliveries, reads and other objects', () => {
    expect(
      parseMessengerMessages(
        pageBody(
          'page-1',
          textEvent({ message: { mid: 'm_2', text: 'bot', is_echo: true } }),
          { sender: { id: 'c' }, delivery: { mids: ['m_1'] } },
          { sender: { id: 'c' }, read: { watermark: 1 } },
        ),
      ),
    ).toEqual([]);
    expect(parseMessengerMessages({ object: 'instagram', entry: [] })).toEqual(
      [],
    );
    expect(parseMessengerMessages(null)).toEqual([]);
  });

  it('keeps every message when Meta batches several entries', () => {
    const body = {
      object: 'page',
      entry: [
        { id: 'page-1', messaging: [textEvent()] },
        {
          id: 'page-2',
          messaging: [textEvent({ message: { mid: 'm_9', text: 'hi' } })],
        },
      ],
    };
    expect(parseMessengerMessages(body).map((m) => m.messageId)).toEqual([
      'm_1',
      'm_9',
    ]);
  });
});

describe('Messenger trigger routing', () => {
  it('reads the credential of Messenger trigger nodes', () => {
    expect(
      findTriggerNodes(definition(messengerTrigger(PAGE_CREDENTIAL_ID))),
    ).toEqual([
      {
        nodeId: 'chat',
        triggerKey: 'trigger.messenger.message',
        channel: TriggerChannel.MESSENGER,
        credentialId: PAGE_CREDENTIAL_ID,
      },
    ]);
  });

  it('listens on the Page id of the credential after publishing', async () => {
    const repository = new MemoryTriggerRepository();
    await new SyncWorkflowTriggersHandler(repository).handle(
      new WorkflowPublishedEvent(
        'wf',
        'v1',
        definition(messengerTrigger(PAGE_CREDENTIAL_ID)),
      ),
    );

    expect(repository.rows).toEqual([
      expect.objectContaining({
        workflowVersionId: 'v1',
        channel: TriggerChannel.MESSENGER,
        routingKey: 'page-1',
        isActive: true,
      }),
    ]);
  });

  it('skips a Messenger trigger whose credential is gone', async () => {
    const repository = new MemoryTriggerRepository();
    await new SyncWorkflowTriggersHandler(repository).handle(
      new WorkflowPublishedEvent(
        'wf',
        'v1',
        definition(messengerTrigger('55555555-5555-5555-5555-000000000000')),
      ),
    );
    expect(repository.rows).toEqual([]);
  });
});

describe('CheckPublishTriggersHandler', () => {
  const check = (repository: MemoryTriggerRepository, ...nodes: unknown[]) =>
    new CheckPublishTriggersHandler(repository).execute(
      new CheckPublishTriggersQuery('wf', 'owner-1', definition(...nodes)),
    );

  it('passes a Page nobody else listens on', async () => {
    await expect(
      check(
        new MemoryTriggerRepository(),
        messengerTrigger(PAGE_CREDENTIAL_ID),
      ),
    ).resolves.toEqual([]);
  });

  it('blocks a Page another workflow already listens on, naming that workflow', async () => {
    const repository = new MemoryTriggerRepository();
    await repository.replaceActive('wf-other', 'v-other', [
      {
        nodeId: 'x',
        triggerKey: 'trigger.messenger.message',
        channel: TriggerChannel.MESSENGER,
        routingKey: 'page-1',
      },
    ]);

    const [issue] = await check(
      repository,
      messengerTrigger(PAGE_CREDENTIAL_ID),
    );
    expect(issue).toMatchObject({
      code: 'CHANNEL_ALREADY_BOUND',
      severity: 'error',
      nodeId: 'chat',
    });
    expect(issue.message).toContain('"Other workflow"');
  });

  it('lets the same workflow publish again on its own Page', async () => {
    const repository = new MemoryTriggerRepository();
    await repository.replaceActive('wf', 'v1', [
      {
        nodeId: 'chat',
        triggerKey: 'trigger.messenger.message',
        channel: TriggerChannel.MESSENGER,
        routingKey: 'page-1',
      },
    ]);
    await expect(
      check(repository, messengerTrigger(PAGE_CREDENTIAL_ID)),
    ).resolves.toEqual([]);
  });

  it('blocks two triggers on one Page in the same workflow', async () => {
    const issues = await check(
      new MemoryTriggerRepository(),
      messengerTrigger(PAGE_CREDENTIAL_ID, 'a'),
      messengerTrigger(PAGE_CREDENTIAL_ID, 'b'),
      messengerTrigger(OTHER_PAGE_CREDENTIAL_ID, 'c'),
    );
    expect(issues).toEqual([
      expect.objectContaining({ code: 'CHANNEL_ALREADY_BOUND', nodeId: 'b' }),
    ]);
  });

  it('reports a missing, foreign or non-Messenger credential', async () => {
    const issues = await check(
      new MemoryTriggerRepository(),
      messengerTrigger('55555555-5555-5555-5555-000000000000', 'gone'),
      messengerTrigger(LLM_CREDENTIAL_ID, 'llm'),
      messengerTrigger('not-a-uuid', 'bad'),
    );
    expect(issues.map((i) => [i.code, i.nodeId])).toEqual([
      ['INVALID_CREDENTIAL', 'gone'],
      ['INVALID_CREDENTIAL', 'llm'],
      ['INVALID_CREDENTIAL', 'bad'],
    ]);
  });
});

describe('ReceiveMessengerEventsHandler', () => {
  async function setup() {
    const repository = new MemoryTriggerRepository();
    await repository.replaceActive('wf', 'v1', [
      {
        nodeId: 'chat',
        triggerKey: 'trigger.messenger.message',
        channel: TriggerChannel.MESSENGER,
        routingKey: 'page-1',
      },
    ]);
    let next = 0;
    const commandBus = {
      execute: jest.fn(() => Promise.resolve(`execution-${(next += 1)}`)),
    };
    const handler = new ReceiveMessengerEventsHandler(
      repository,
      new MemoryDedup(),
      commandBus as unknown as CommandBus,
    );
    return { handler, commandBus };
  }

  it('queues one run of the listening version per customer message', async () => {
    const { handler, commandBus } = await setup();

    const result = await handler.execute(
      new ReceiveMessengerEventsCommand(
        pageBody(
          'page-1',
          textEvent(),
          textEvent({ message: { mid: 'm_2', text: 'second' } }),
        ),
      ),
    );

    expect(result).toEqual({
      started: ['execution-1', 'execution-2'],
      ignored: 0,
    });
    const [command] = commandBus.execute.mock.calls[0] as unknown as [
      EnqueueExecutionCommand,
    ];
    expect(command.workflowVersionId).toBe('v1');
    expect(command.triggerItems[0].json).toMatchObject({
      sender_id: 'customer-1',
      text: 'Còn size M không shop?',
    });
  });

  it('runs a message only once when Meta delivers it again', async () => {
    const { handler, commandBus } = await setup();
    const body = pageBody('page-1', textEvent());

    await handler.execute(new ReceiveMessengerEventsCommand(body));
    const retry = await handler.execute(
      new ReceiveMessengerEventsCommand(body),
    );

    expect(retry).toEqual({ started: [], ignored: 1 });
    expect(commandBus.execute).toHaveBeenCalledTimes(1);
  });

  it('ignores messages to a Page no workflow listens on', async () => {
    const { handler, commandBus } = await setup();

    const result = await handler.execute(
      new ReceiveMessengerEventsCommand(pageBody('page-9', textEvent())),
    );

    expect(result).toEqual({ started: [], ignored: 1 });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
