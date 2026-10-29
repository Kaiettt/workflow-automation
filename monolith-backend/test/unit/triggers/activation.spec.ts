/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { createHmac } from 'node:crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { CommandBus } from '@nestjs/cqrs';
import { PackageRegistry } from '@app/apps';
import { EnqueueExecutionCommand } from '@app/execution/application/commands/enqueue-execution/enqueue-execution.command';
import { ActivationService } from '@app/triggers/application/activation.service';
import { EndpointRegistrar } from '@app/triggers/application/endpoint-registrar';
import { TestListenService } from '@app/triggers/application/test-listen.service';
import {
  ReceiveWebhookCommand,
  ReceiveWebhookHandler,
} from '@app/triggers/application/commands/receive-webhook.command';
import { FakeMetaGraph } from '@test/support/apps/fake-meta-graph';
import {
  definition,
  MemoryDedup,
  MemoryTestEventStore,
  MemoryTriggerRepository,
  MemoryVault,
  MESSENGER_CREDENTIAL_ID,
  node,
  OWNER,
  testRegistry,
} from '@test/support/triggers/memory-triggers';

const BASE = 'https://flow.test';
const messengerTrigger = (id: string, config: Record<string, unknown> = {}) =>
  node(id, 'messenger.trigger', {
    credential_id: MESSENGER_CREDENTIAL_ID,
    page_id: 'page-1',
    ...config,
  });
const webhookTrigger = (id = 'hook') => node(id, 'webhook.trigger');

describe('workflow activation and webhooks', () => {
  const previousBase = process.env['PUBLIC_BASE_URL'];
  let graph: FakeMetaGraph;
  let registry: PackageRegistry;
  let repository: MemoryTriggerRepository;
  let vault: MemoryVault;
  let tests: MemoryTestEventStore;
  let registrar: EndpointRegistrar;
  let activation: ActivationService;
  let testListen: TestListenService;
  let ingress: ReceiveWebhookHandler;
  let enqueued: EnqueueExecutionCommand[];

  beforeEach(() => {
    process.env['PUBLIC_BASE_URL'] = BASE;
    graph = new FakeMetaGraph();
    registry = testRegistry(graph);
    repository = new MemoryTriggerRepository();
    vault = new MemoryVault();
    tests = new MemoryTestEventStore();
    registrar = new EndpointRegistrar(
      registry,
      repository,
      vault.asVault(),
      tests,
    );
    activation = new ActivationService(
      registry,
      repository,
      registrar,
      vault.asVault(),
    );
    testListen = new TestListenService(
      registry,
      repository,
      registrar,
      activation,
      tests,
    );
    enqueued = [];
    const commandBus = {
      execute: (command: EnqueueExecutionCommand) => {
        enqueued.push(command);
        return Promise.resolve(`exec-${enqueued.length}`);
      },
    } as unknown as CommandBus;
    ingress = new ReceiveWebhookHandler(
      registry,
      repository,
      vault.asVault(),
      new MemoryDedup(),
      tests,
      commandBus,
    );
  });

  afterEach(() => {
    testListen.onModuleDestroy();
    if (previousBase === undefined) delete process.env['PUBLIC_BASE_URL'];
    else process.env['PUBLIC_BASE_URL'] = previousBase;
  });

  const endpointUrl = (scopeKey: string) =>
    `${BASE}/api/webhooks/${repository.endpointOf(scopeKey)!.id}`;

  const postSigned = (endpointId: string, body: unknown) => {
    const raw = Buffer.from(JSON.stringify(body));
    return ingress.execute(
      new ReceiveWebhookCommand(endpointId, {
        method: 'POST',
        headers: {
          'x-hub-signature-256': `sha256=${createHmac('sha256', 'app-secret').update(raw).digest('hex')}`,
        },
        query: {},
        body,
        rawBody: raw,
      }),
    );
  };

  const message = (mid: string, text: string, pageId = 'page-1') => ({
    object: 'page',
    entry: [
      {
        id: pageId,
        messaging: [{ sender: { id: 'customer-1' }, message: { mid, text } }],
      },
    ],
  });

  describe('activate', () => {
    it('needs a published version', async () => {
      repository.addWorkflow('wf', definition(webhookTrigger()), {
        published: false,
      });
      await expect(activation.activate('wf', OWNER)).rejects.toThrow(
        'Publish the workflow before activating it.',
      );
    });

    it('needs a trigger that listens for events', async () => {
      repository.addWorkflow('wf', definition(node('m', 'trigger.manual')));
      await expect(activation.activate('wf', OWNER)).rejects.toThrow(
        'no trigger that listens',
      );
      expect(repository.workflows.get('wf')!.active).toBe(false);
    });

    it('is only for the owner', async () => {
      repository.addWorkflow('wf', definition(webhookTrigger()));
      await expect(
        activation.activate('wf', 'someone-else'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('turns a webhook workflow on with a stable URL', async () => {
      repository.addWorkflow('wf', definition(webhookTrigger()));
      const before = await activation.webhooks('wf', OWNER);
      expect(before).toEqual([
        {
          nodeId: 'hook',
          nodeKey: 'webhook.trigger',
          scope: 'node',
          url: endpointUrl('node:wf:hook'),
        },
      ]);

      expect(await activation.activate('wf', OWNER)).toEqual({
        active: true,
        versionId: 'wf-v1',
      });
      expect(repository.listeners).toHaveLength(1);
      expect(repository.endpointOf('node:wf:hook')!.registered).toBe(true);

      // Deactivate / activate keeps the URL.
      await activation.deactivate('wf', OWNER);
      await activation.activate('wf', OWNER);
      expect(await activation.webhooks('wf', OWNER)).toEqual(before);
    });

    it('registers a Messenger webhook with the user’s Meta App', async () => {
      repository.addWorkflow('wf', definition(messengerTrigger('chat')));
      await activation.activate('wf', OWNER);

      const url = endpointUrl(`credential:${MESSENGER_CREDENTIAL_ID}`);
      expect(graph.appSubscriptions.get('app-1')).toMatchObject({
        callbackUrl: url,
        verifyToken: repository.endpointOf(
          `credential:${MESSENGER_CREDENTIAL_ID}`,
        )!.data.verify_token,
      });
      expect(graph.calls).toContain('subscribePage page-1 EAApage1');
      expect(repository.workflows.get('wf')!.active).toBe(true);
    });

    it('leaves the workflow off when the app refuses, with nothing registered', async () => {
      repository.addWorkflow('wf', definition(messengerTrigger('chat')));
      graph.subscribeFailure = new Error('Invalid OAuth access token');

      const failure = activation.activate('wf', OWNER);
      await expect(failure).rejects.toBeInstanceOf(BadRequestException);
      await expect(failure).rejects.toThrow(
        '"chat": Invalid OAuth access token',
      );
      expect(repository.workflows.get('wf')!.active).toBe(false);
      expect(repository.listeners).toHaveLength(0);
      expect(
        repository.endpointOf(`credential:${MESSENGER_CREDENTIAL_ID}`)!
          .registered,
      ).toBe(false);
    });

    it('checks the credential of the trigger', async () => {
      repository.addWorkflow(
        'wf',
        definition(messengerTrigger('chat', { credential_id: undefined })),
      );
      await expect(activation.activate('wf', OWNER)).rejects.toThrow(
        '"chat": choose a Facebook Messenger account credential.',
      );
    });
  });

  describe('deactivate and publish', () => {
    it('unregisters the shared endpoint only when its last workflow stops', async () => {
      repository.addWorkflow('a', definition(messengerTrigger('chat')));
      repository.addWorkflow(
        'b',
        definition(messengerTrigger('chat', { keywords: 'giá' })),
      );
      await activation.activate('a', OWNER);
      await activation.activate('b', OWNER);

      await activation.deactivate('a', OWNER);
      expect(graph.appSubscriptions.size).toBe(1);
      await activation.deactivate('b', OWNER);
      expect(graph.appSubscriptions.size).toBe(0);
      expect(graph.calls).toContain('unsubscribePage page-1');
    });

    it('moves an active workflow to the new version', async () => {
      repository.addWorkflow('wf', definition(webhookTrigger('old')), {
        active: true,
      });
      await activation.activate('wf', OWNER);
      repository.publish('wf', definition(webhookTrigger('new')));

      expect(await activation.switchVersion('wf')).toEqual({ active: true });
      expect(
        repository.listeners.map((l) => [l.nodeId, l.workflowVersionId]),
      ).toEqual([['new', 'wf-v2']]);
    });

    it('turns the workflow off when the new version cannot listen', async () => {
      repository.addWorkflow('wf', definition(webhookTrigger()));
      await activation.activate('wf', OWNER);
      repository.publish('wf', definition(node('m', 'trigger.manual')));

      const result = await activation.switchVersion('wf');
      expect(result).toEqual({
        active: false,
        error: expect.stringContaining('no trigger'),
      });
      expect(repository.workflows.get('wf')!.active).toBe(false);
      expect(repository.listeners).toHaveLength(0);
    });

    it('does nothing for an inactive workflow', async () => {
      repository.addWorkflow('wf', definition(webhookTrigger()));
      expect(await activation.switchVersion('wf')).toBeNull();
    });
  });

  describe('incoming events', () => {
    it('answers 404 on a per-node URL nobody listens on', async () => {
      repository.addWorkflow('wf', definition(webhookTrigger()));
      await activation.webhooks('wf', OWNER);
      const endpoint = repository.endpointOf('node:wf:hook')!;
      const result = await ingress.execute(
        new ReceiveWebhookCommand(endpoint.id, {
          method: 'POST',
          headers: {},
          query: {},
          body: { a: 1 },
        }),
      );
      expect(result).toEqual({ outcome: 'not-found' });
      expect(
        await ingress.execute(
          new ReceiveWebhookCommand('not-a-uuid', {
            method: 'POST',
            headers: {},
            query: {},
            body: null,
          }),
        ),
      ).toEqual({ outcome: 'not-found' });
    });

    it('runs the active webhook workflow once per Idempotency-Key', async () => {
      repository.addWorkflow('wf', definition(webhookTrigger()));
      await activation.activate('wf', OWNER);
      const endpoint = repository.endpointOf('node:wf:hook')!;
      const call = () =>
        ingress.execute(
          new ReceiveWebhookCommand(endpoint.id, {
            method: 'POST',
            headers: { 'idempotency-key': 'k1' },
            query: {},
            body: { order: 7 },
          }),
        );

      expect(await call()).toEqual({
        outcome: 'handled',
        status: 202,
        contentType: undefined,
        body: { success: true, data: { started: ['exec-1'], ignored: 0 } },
      });
      expect(enqueued[0].workflowVersionId).toBe('wf-v1');
      expect(enqueued[0].triggerItems[0].json).toMatchObject({
        body: { order: 7 },
      });
      expect(await call()).toMatchObject({
        body: { success: true, data: { started: [], ignored: 1 } },
      });
    });

    it('runs every matching Messenger workflow', async () => {
      repository.addWorkflow('all', definition(messengerTrigger('chat')));
      repository.addWorkflow(
        'prices',
        definition(messengerTrigger('chat', { keywords: 'giá' })),
      );
      repository.addWorkflow(
        'other-page',
        definition(messengerTrigger('chat', { page_id: 'page-2' })),
      );
      for (const id of ['all', 'prices', 'other-page'])
        await activation.activate(id, OWNER);
      const endpoint = repository.endpointOf(
        `credential:${MESSENGER_CREDENTIAL_ID}`,
      )!;

      const priceQuestion = await postSigned(
        endpoint.id,
        message('m1', 'Bảng GIÁ?'),
      );
      expect(priceQuestion).toMatchObject({
        status: 200,
        body: { data: { started: ['exec-1', 'exec-2'], ignored: 0 } },
      });
      expect(enqueued.map((c) => c.workflowVersionId).sort()).toEqual([
        'all-v1',
        'prices-v1',
      ]);

      await postSigned(endpoint.id, message('m2', 'Xin chào'));
      expect(enqueued.map((c) => c.workflowVersionId)).toHaveLength(3);
      expect(enqueued[2].workflowVersionId).toBe('all-v1');
    });

    it('acks Meta’s handshake before anyone listens', async () => {
      repository.addWorkflow('wf', definition(messengerTrigger('chat')));
      // Meta calls back while the subscription is created.
      let answered: unknown;
      graph.onSubscribeApp = async ({ callbackUrl, verifyToken }) => {
        answered = await ingress.execute(
          new ReceiveWebhookCommand(callbackUrl.split('/').pop()!, {
            method: 'GET',
            headers: {},
            query: {
              'hub.mode': 'subscribe',
              'hub.verify_token': verifyToken,
              'hub.challenge': 'c1',
            },
            body: null,
          }),
        );
      };
      await activation.activate('wf', OWNER);
      expect(answered).toMatchObject({
        outcome: 'handled',
        status: 200,
        body: 'c1',
      });
    });
  });

  describe('test events', () => {
    it('captures one event of the draft config without running anything', async () => {
      repository.addWorkflow(
        'wf',
        definition(messengerTrigger('chat', { keywords: 'giá' })),
        {
          published: false,
        },
      );
      const started = await testListen.start('wf', 'chat', OWNER);
      expect(started.status).toBe('waiting');
      // The endpoint is registered for the test.
      expect(graph.appSubscriptions.size).toBe(1);
      const endpoint = repository.endpointOf(
        `credential:${MESSENGER_CREDENTIAL_ID}`,
      )!;

      await postSigned(endpoint.id, message('m1', 'hello'));
      expect((await testListen.get(started.listenId, OWNER)).status).toBe(
        'waiting',
      );
      await postSigned(endpoint.id, message('m2', 'giá bao nhiêu'));

      const outcome = await testListen.get(started.listenId, OWNER);
      expect(outcome.status).toBe('received');
      expect(outcome.event).toMatchObject({
        text: 'giá bao nhiêu',
        sender_id: 'customer-1',
      });
      expect(enqueued).toHaveLength(0);
    });

    it('stopping unregisters an endpoint only the test used', async () => {
      repository.addWorkflow('wf', definition(webhookTrigger()), {
        published: false,
      });
      const started = await testListen.start('wf', 'hook', OWNER);
      const endpoint = repository.endpointOf('node:wf:hook')!;
      const received = await ingress.execute(
        new ReceiveWebhookCommand(endpoint.id, {
          method: 'POST',
          headers: {},
          query: {},
          body: { ping: true },
        }),
      );
      expect(received).toMatchObject({ status: 202 });
      expect(
        (await testListen.get(started.listenId, OWNER)).event,
      ).toMatchObject({
        body: { ping: true },
      });

      await testListen.stop(started.listenId, OWNER);
      expect(repository.endpointOf('node:wf:hook')!.registered).toBe(false);
      await expect(testListen.get(started.listenId, OWNER)).rejects.toThrow(
        'not found',
      );
    });

    it('refuses nodes that do not receive events', async () => {
      repository.addWorkflow('wf', definition(node('m', 'trigger.manual')));
      await expect(testListen.start('wf', 'm', OWNER)).rejects.toThrow(
        'This node does not receive events',
      );
    });
  });
});
