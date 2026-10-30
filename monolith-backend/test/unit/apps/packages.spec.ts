/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { createHmac } from 'node:crypto';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  AppApiError,
  credentialConfigSchema,
  IntegrationPackage,
  matchesKeywords,
  nodeConfigSchema,
  PackageRegistry,
  TriggerNode,
  WebhookRequest,
} from '@app/apps';
import { webhookPackage } from '@app/apps/webhook/webhook.package';
import { createMessengerPackage } from '@app/apps/messenger/messenger.package';
import { toAppApiError } from '@app/apps/messenger/meta-graph.api';
import { FakeMetaGraph } from '@test/support/apps/fake-meta-graph';
import { messengerSecret } from '@test/support/triggers/memory-triggers';

const request = (overrides: Partial<WebhookRequest> = {}): WebhookRequest => ({
  method: 'POST',
  headers: {},
  query: {},
  body: null,
  ...overrides,
});

const signed = (body: unknown, secret = 'app-secret') => {
  const raw = Buffer.from(JSON.stringify(body));
  return request({
    body,
    rawBody: raw,
    headers: {
      'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`,
    },
  });
};

const pageMessage = (
  text: string,
  extra: Record<string, unknown> = {},
  pageId = 'page-1',
) => ({
  object: 'page',
  entry: [
    {
      id: pageId,
      messaging: [
        {
          sender: { id: 'customer-1' },
          timestamp: Date.UTC(2026, 9, 30),
          message: { mid: 'm_1', text, ...extra },
        },
      ],
    },
  ],
});

describe('integration packages', () => {
  let graph: FakeMetaGraph;
  let messenger: IntegrationPackage;
  let trigger: TriggerNode;

  beforeEach(() => {
    graph = new FakeMetaGraph();
    messenger = createMessengerPackage(graph);
    trigger = messenger.nodes.find(
      (n) => n.key === 'messenger.trigger',
    ) as TriggerNode;
  });

  describe('catalog schemas', () => {
    it('describes a node with credential, expressions and dynamic options', () => {
      const send = messenger.nodes.find(
        (n) => n.key === 'messenger.sendMessage',
      )!;
      const schema = nodeConfigSchema(send) as {
        required: string[];
        'x-propertyOrder': string[];
        properties: Record<string, Record<string, unknown>>;
      };
      expect(schema.required).toEqual([
        'credential_id',
        'page_id',
        'recipient_id',
      ]);
      expect(schema['x-propertyOrder']).toEqual([
        'credential_id',
        'page_id',
        'recipient_id',
        'message_type',
        'text',
        'quick_replies',
        'buttons',
        'attachment_type',
        'attachment_url',
      ]);
      expect(schema.properties.credential_id).toMatchObject({
        'x-refType': 'credential',
        'x-connectorKey': 'facebookMessengerOAuth2',
        'x-credentialInput': 'form',
      });
      expect(schema.properties.page_id).toMatchObject({
        type: 'string',
        'x-loadOptions': true,
      });
      expect(schema.properties.text).toMatchObject({
        'x-allowExpression': true,
        'x-multiline': true,
      });
      expect(schema.properties.recipient_id.default).toBe(
        '{{$node["Messenger Trigger"].json.sender_id}}',
      );
    });

    it('marks triggers with their webhook scope', () => {
      expect(nodeConfigSchema(trigger)['x-webhook']).toEqual({
        scope: 'credential',
      });
      expect(nodeConfigSchema(webhookPackage.nodes[0])['x-webhook']).toEqual({
        scope: 'node',
      });
    });

    it('describes an OAuth2 credential form with hidden secrets', () => {
      expect(credentialConfigSchema(messenger.credentials[0])).toEqual({
        type: 'object',
        required: ['client_id', 'client_secret'],
        'x-propertyOrder': ['client_id', 'client_secret'],
        'x-oauth2': true,
        properties: {
          client_id: {
            type: 'string',
            title: 'App ID',
            description: 'Meta App dashboard → App settings → Basic',
          },
          client_secret: {
            type: 'string',
            title: 'App Secret',
            'x-secret': true,
          },
        },
      });
    });

    it('refuses two packages declaring the same node type', () => {
      expect(
        () => new PackageRegistry([webhookPackage, webhookPackage]),
      ).toThrow('Node type "webhook.trigger" is declared twice');
    });
  });

  describe('Webhook', () => {
    const hook = webhookPackage.nodes[0] as TriggerNode;

    it('turns a POST into one event without the caller’s secrets', async () => {
      const result = await hook.webhook.handle({
        request: request({
          body: { order: 1 },
          query: { a: '1' },
          headers: {
            'content-type': 'application/json',
            authorization: 'Bearer x',
            'idempotency-key': ' order-1 ',
          },
        }),
        credential: null,
        data: {},
      });
      expect(result.status).toBe(202);
      expect(result.events).toEqual([
        {
          id: 'order-1',
          json: expect.objectContaining({
            body: { order: 1 },
            query: { a: '1' },
            headers: {
              'content-type': 'application/json',
              'idempotency-key': ' order-1 ',
            },
          }),
        },
      ]);
    });

    it('refuses other methods', async () => {
      const result = await hook.webhook.handle({
        request: request({ method: 'GET' }),
        credential: null,
        data: {},
      });
      expect(result).toMatchObject({ status: 405, events: [] });
    });
  });

  describe('Messenger trigger', () => {
    it('answers Meta’s check with the endpoint’s verify token only', async () => {
      const data = trigger.webhook.initialData!();
      expect(typeof data.verify_token).toBe('string');
      const check = (token: string) =>
        trigger.webhook.handle({
          request: request({
            method: 'GET',
            query: {
              'hub.mode': 'subscribe',
              'hub.verify_token': token,
              'hub.challenge': '42',
            },
          }),
          credential: messengerSecret(),
          data,
        });
      expect(await check(data.verify_token as string)).toMatchObject({
        status: 200,
        body: '42',
        contentType: 'text/plain',
      });
      expect(await check('wrong')).toMatchObject({ status: 403 });
    });

    it('verifies the signature with the App Secret of the credential', async () => {
      const ok = await trigger.webhook.handle({
        request: signed(pageMessage('Xin chào')),
        credential: messengerSecret(),
        data: {},
      });
      expect(ok.status).toBe(200);
      expect(ok.events).toEqual([
        {
          id: 'm_1',
          json: expect.objectContaining({
            message_id: 'm_1',
            sender_id: 'customer-1',
            page_id: 'page-1',
            text: 'Xin chào',
            timestamp: '2026-10-30T00:00:00.000Z',
          }),
        },
      ]);

      const forged = await trigger.webhook.handle({
        request: signed(pageMessage('hi'), 'other-secret'),
        credential: messengerSecret(),
        data: {},
      });
      expect(forged).toMatchObject({ status: 401, events: [] });
    });

    it('drops the Page’s own echoes', async () => {
      const result = await trigger.webhook.handle({
        request: signed(pageMessage('bot reply', { is_echo: true })),
        credential: messengerSecret(),
        data: {},
      });
      expect(result.events).toEqual([]);
    });

    it('accepts events of its Page, filtered by optional keywords', () => {
      const event = (text: string, pageId = 'page-1') => ({
        json: { page_id: pageId, text },
      });
      const accepts = (
        e: { json: Record<string, unknown> },
        parameters: Record<string, unknown>,
      ) => trigger.webhook.accepts!(e, parameters);
      expect(accepts(event('hi'), { page_id: 'page-1' })).toBe(true);
      expect(accepts(event('hi', 'page-2'), { page_id: 'page-1' })).toBe(false);
      expect(
        accepts(event('Cho xin BẢNG GIA'), {
          page_id: 'page-1',
          keywords: 'giá, bảng giá',
        }),
      ).toBe(true);
      expect(
        accepts(event('Xin chào'), { page_id: 'page-1', keywords: 'giá' }),
      ).toBe(false);
      expect(matchesKeywords('Đặt hàng', ' , ')).toBe(true);
    });

    it('subscribes the Meta App and the listened Pages, then finds them registered', async () => {
      const context = {
        url: 'https://flow.test/api/webhooks/e1',
        credential: messengerSecret(),
        data: { verify_token: 'vt' } as Record<string, unknown>,
        listeners: [
          { page_id: 'page-1' },
          { page_id: 'page-1', keywords: 'giá' },
        ],
      };
      expect(await trigger.webhook.checkExists!(context)).toBe(false);
      await trigger.webhook.create!(context);

      expect(graph.appSubscriptions.get('app-1')).toMatchObject({
        callbackUrl: 'https://flow.test/api/webhooks/e1',
        verifyToken: 'vt',
        appToken: 'app-1|app-secret',
      });
      expect(graph.calls).toContain('subscribePage page-1 EAApage1');
      expect(context.data.pages).toEqual(['page-1']);
      expect(await trigger.webhook.checkExists!(context)).toBe(true);
      // Another Page joins: not registered yet.
      expect(
        await trigger.webhook.checkExists!({
          ...context,
          listeners: [{ page_id: 'page-2' }],
        }),
      ).toBe(false);

      await trigger.webhook.delete!(context);
      expect(graph.appSubscriptions.size).toBe(0);
      expect(graph.calls).toContain('unsubscribePage page-1');
      expect(context.data.pages).toEqual([]);
    });

    it('refuses a Page the credential was not granted', async () => {
      await expect(
        trigger.webhook.create!({
          url: 'u',
          credential: messengerSecret(),
          data: {},
          listeners: [{ page_id: 'page-9' }],
        }),
      ).rejects.toThrow('Page page-9 is not connected to this credential');
    });

    it('lists the Pages of the credential as options', async () => {
      const page = trigger.properties.find((p) => p.name === 'page_id')!;
      expect(
        await page.loadOptions!({ credential: messengerSecret() }),
      ).toEqual([
        { value: 'page-1', label: 'Shop ABC' },
        { value: 'page-2', label: 'Shop XYZ' },
      ]);
    });
  });

  describe('Messenger credential and send', () => {
    it('exchanges the code for a long-lived token and the granted Pages', async () => {
      const values = await messenger.credentials[0].oauth2!.exchangeCode({
        code: 'abc',
        redirectUri: 'https://flow.test/api/oauth2/callback',
        values: { client_id: 'app-1', client_secret: 's' },
      });
      expect(graph.exchanged).toEqual([
        {
          appId: 'app-1',
          code: 'abc',
          redirectUri: 'https://flow.test/api/oauth2/callback',
        },
      ]);
      expect(values).toMatchObject({
        access_token: 'long-short-token-for-abc',
        pages: [{ id: 'page-1', name: 'Shop ABC', access_token: 'EAApage1' }],
      });
      expect(typeof values.token_expires_at).toBe('string');
    });

    it('fails clearly when no Page was shared', async () => {
      graph.pages = [];
      await expect(
        messenger.credentials[0].oauth2!.exchangeCode({
          code: 'abc',
          redirectUri: 'r',
          values: { client_id: 'app-1', client_secret: 's' },
        }),
      ).rejects.toThrow('No Facebook Page was shared');
    });

    it('sends with the token of the chosen Page', async () => {
      const send = messenger.nodes.find(
        (n) => n.key === 'messenger.sendMessage',
      )!;
      if (send.kind !== 'action') throw new Error('not an action');
      const output = await send.execute({
        parameters: {
          page_id: 'page-2',
          recipient_id: ' customer-1 ',
          text: 'Chào bạn',
        },
        credential: messengerSecret(),
        item: { json: {} },
      });
      expect(graph.sent).toEqual([
        {
          pageAccessToken: 'EAApage2',
          recipientId: 'customer-1',
          message: { text: 'Chào bạn' },
        },
      ]);
      expect(output).toEqual({
        page_id: 'page-2',
        recipient_id: 'customer-1',
        message_id: 'mid.1',
        status: 'sent',
      });
      await expect(
        send.execute({
          parameters: {
            page_id: 'page-1',
            recipient_id: 'c',
            text: 'x'.repeat(2001),
          },
          credential: messengerSecret(),
          item: { json: {} },
        }),
      ).rejects.toThrow('limited to 2000 characters');
    });
  });

  describe('Graph errors', () => {
    const graphError = (status: number, error: Record<string, unknown>) =>
      new AxiosError('failed', 'ERR', undefined, undefined, {
        status,
        data: { error },
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
      });

    it('retries rate limits and outages only', () => {
      expect(toAppApiError(graphError(500, { message: 'x' })).retryable).toBe(
        true,
      );
      expect(toAppApiError(graphError(400, { code: 4 })).retryable).toBe(true);
      const window = toAppApiError(
        graphError(400, { code: 10, error_subcode: 2018278 }),
      );
      expect(window).toBeInstanceOf(AppApiError);
      expect(window.retryable).toBe(false);
      expect(window.message).toContain('24 hours');
      expect(toAppApiError(graphError(400, { code: 190 })).message).toContain(
        'reconnect',
      );
    });
  });
});
