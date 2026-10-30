/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { createHmac } from 'node:crypto';
import {
  ActionNode,
  nodeConfigSchema,
  TriggerNode,
  WebhookRequest,
} from '@app/apps';
import {
  buildMessage,
  createMessengerPackage,
} from '@app/apps/messenger/messenger.package';
import { FakeMetaGraph, SUBSCRIBED } from '@test/support/apps/fake-meta-graph';
import { messengerSecret } from '@test/support/triggers/memory-triggers';

const signed = (body: unknown): WebhookRequest => {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    method: 'POST',
    query: {},
    body,
    rawBody: raw,
    headers: {
      'x-hub-signature-256': `sha256=${createHmac('sha256', 'app-secret').update(raw).digest('hex')}`,
    },
  };
};

const entry = (event: Record<string, unknown>) => ({
  object: 'page',
  entry: [
    {
      id: 'page-1',
      messaging: [
        {
          sender: { id: 'customer-1' },
          timestamp: Date.UTC(2026, 9, 30),
          ...event,
        },
      ],
    },
  ],
});

describe('Messenger chatbot features', () => {
  let graph: FakeMetaGraph;
  let trigger: TriggerNode;
  let send: ActionNode;
  let action: ActionNode;

  beforeEach(() => {
    graph = new FakeMetaGraph();
    const messenger = createMessengerPackage(graph);
    trigger = messenger.nodes.find(
      (n) => n.key === 'messenger.trigger',
    ) as TriggerNode;
    send = messenger.nodes.find(
      (n) => n.key === 'messenger.sendMessage',
    ) as ActionNode;
    action = messenger.nodes.find(
      (n) => n.key === 'messenger.senderAction',
    ) as ActionNode;
  });

  const events = async (body: unknown) =>
    (
      await trigger.webhook.handle({
        request: signed(body),
        credential: messengerSecret(),
        data: {},
      })
    ).events;

  describe('trigger events', () => {
    it('turns a tap on a button into a postback event with its payload', async () => {
      const [event] = await events(
        entry({
          postback: { mid: 'pb_1', title: 'Xem giá', payload: 'PRICE' },
        }),
      );
      expect(event.id).toBe('pb_1');
      expect(event.json).toMatchObject({
        type: 'postback',
        sender_id: 'customer-1',
        page_id: 'page-1',
        text: 'Xem giá',
        payload: 'PRICE',
      });
    });

    it('names a postback without a mid by who, when and what, so a retry is the same event', async () => {
      const body = entry({ postback: { title: 'Xem giá', payload: 'PRICE' } });
      const [first] = await events(body);
      const [again] = await events(body);
      expect(first.id).toMatch(/^postback:page-1:customer-1:\d+:PRICE$/);
      expect(again.id).toBe(first.id);
    });

    it('carries the payload of a tapped quick reply on the message event', async () => {
      const [event] = await events(
        entry({
          message: {
            mid: 'm_1',
            text: 'Xem giá',
            quick_reply: { payload: 'PRICE' },
          },
        }),
      );
      expect(event.json).toMatchObject({
        type: 'message',
        text: 'Xem giá',
        payload: 'PRICE',
      });
    });

    it('has no payload on a typed message', async () => {
      const [event] = await events(
        entry({ message: { mid: 'm_1', text: 'hi' } }),
      );
      expect(event.json).toMatchObject({ type: 'message', payload: null });
    });

    it('ignores a postback without a payload', async () => {
      expect(await events(entry({ postback: { title: 'x' } }))).toEqual([]);
    });
  });

  describe('trigger filters', () => {
    const accepts = (json: Record<string, unknown>, parameters: object) =>
      trigger.webhook.accepts!(
        { json: { page_id: 'page-1', text: '', payload: null, ...json } },
        { page_id: 'page-1', ...parameters },
      );

    it('takes messages and button clicks by default, also for workflows saved before the setting', () => {
      expect(accepts({ type: 'message' }, {})).toBe(true);
      expect(accepts({ type: 'postback' }, {})).toBe(true);
      expect(accepts({ type: 'postback' }, { events: 'all' })).toBe(true);
    });

    it('can take only messages or only button clicks', () => {
      expect(accepts({ type: 'postback' }, { events: 'message' })).toBe(false);
      expect(accepts({ type: 'message' }, { events: 'message' })).toBe(true);
      expect(accepts({ type: 'message' }, { events: 'postback' })).toBe(false);
      expect(accepts({ type: 'postback' }, { events: 'postback' })).toBe(true);
    });

    it('matches the keywords against the text or the payload', () => {
      const click = { type: 'postback', text: 'Xem', payload: 'PRICE_LIST' };
      expect(accepts(click, { keywords: 'price' })).toBe(true);
      expect(accepts(click, { keywords: 'xem' })).toBe(true);
      expect(accepts(click, { keywords: 'refund' })).toBe(false);
    });

    it('offers the event setting as options', () => {
      const schema = nodeConfigSchema(trigger) as {
        properties: Record<string, Record<string, unknown>>;
      };
      expect(schema.properties.events.enum).toEqual([
        'all',
        'message',
        'postback',
      ]);
      expect(schema.properties.events.default).toBe('all');
    });
  });

  describe('subscription', () => {
    const context = () => ({
      url: 'https://flow.test/api/webhooks/e1',
      credential: messengerSecret(),
      data: { verify_token: 'vt' } as Record<string, unknown>,
      listeners: [{ page_id: 'page-1' }],
    });

    it('subscribes the app and the Page to messages and button clicks', async () => {
      const c = context();
      await trigger.webhook.create!(c);
      expect(graph.appSubscriptions.get('app-1')?.fields).toEqual(SUBSCRIBED);
      expect(graph.pageApps.get('page-1')?.get('app-1')).toEqual(SUBSCRIBED);
      expect(await trigger.webhook.checkExists!(c)).toBe(true);
    });

    it('registers again an app subscribed before button clicks were added', async () => {
      const c = context();
      await trigger.webhook.create!(c);
      graph.appSubscriptions.get('app-1')!.fields = ['messages'];
      expect(await trigger.webhook.checkExists!(c)).toBe(false);

      await trigger.webhook.create!(c);
      expect(await trigger.webhook.checkExists!(c)).toBe(true);
    });

    it('registers again a Page subscribed to messages only', async () => {
      const c = context();
      await trigger.webhook.create!(c);
      graph.pageApps.get('page-1')!.set('app-1', ['messages']);
      expect(await trigger.webhook.checkExists!(c)).toBe(false);
    });
  });

  describe('message building', () => {
    it('sends plain text', () => {
      expect(buildMessage({ text: 'Xin chào' })).toEqual({ text: 'Xin chào' });
      expect(buildMessage({ message_type: 'text', text: 'Hi' })).toEqual({
        text: 'Hi',
      });
    });

    it('needs text and keeps it within the limit', () => {
      expect(() => buildMessage({ text: '  ' })).toThrow('Text is required');
      expect(() => buildMessage({ text: 'x'.repeat(2001) })).toThrow(
        'limited to 2000 characters',
      );
    });

    it('builds quick replies', () => {
      expect(
        buildMessage({
          message_type: 'quick_replies',
          text: 'Bạn cần gì?',
          quick_replies: [
            { title: 'Bảng giá', payload: 'PRICE' },
            { title: 'Nhân viên', payload: 'HUMAN' },
          ],
        }),
      ).toEqual({
        text: 'Bạn cần gì?',
        quick_replies: [
          { content_type: 'text', title: 'Bảng giá', payload: 'PRICE' },
          { content_type: 'text', title: 'Nhân viên', payload: 'HUMAN' },
        ],
      });
    });

    it.each([
      ['no quick reply', [], 'at least one quick reply'],
      [
        'more than 13',
        Array.from({ length: 14 }, (_, n) => ({
          title: `t${n}`,
          payload: 'p',
        })),
        'At most 13',
      ],
      [
        'a title over 20 characters',
        [{ title: 'x'.repeat(21), payload: 'p' }],
        'limited to 20',
      ],
      ['a blank title', [{ title: ' ', payload: 'p' }], 'title is required'],
      ['a missing payload', [{ title: 'Giá' }], 'payload is required'],
    ])('rejects quick replies with %s', (_name, rows, message) => {
      expect(() =>
        buildMessage({
          message_type: 'quick_replies',
          text: 'x',
          quick_replies: rows,
        }),
      ).toThrow(message);
    });

    it('builds a button template with a payload button and a link button', () => {
      expect(
        buildMessage({
          message_type: 'buttons',
          text: 'Chọn một',
          buttons: [
            { type: 'postback', title: 'Giá', payload: 'PRICE' },
            { type: 'web_url', title: 'Website', url: 'https://shop.test/a b' },
          ],
        }),
      ).toEqual({
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: 'Chọn một',
            buttons: [
              { type: 'postback', title: 'Giá', payload: 'PRICE' },
              {
                type: 'web_url',
                title: 'Website',
                url: 'https://shop.test/a%20b',
              },
            ],
          },
        },
      });
    });

    it.each([
      ['no button', [], 'at least one button'],
      [
        'more than 3',
        Array.from({ length: 4 }, () => ({
          type: 'postback',
          title: 't',
          payload: 'p',
        })),
        'At most 3',
      ],
      [
        'a postback without payload',
        [{ type: 'postback', title: 't' }],
        'payload is required',
      ],
      [
        'a link that is not http(s)',
        [{ type: 'web_url', title: 't', url: 'javascript:alert(1)' }],
        'must start with http',
      ],
      [
        'a link that is not a link',
        [{ type: 'web_url', title: 't', url: 'shop' }],
        'must be a link',
      ],
    ])('rejects buttons with %s', (_name, rows, message) => {
      expect(() =>
        buildMessage({ message_type: 'buttons', text: 'x', buttons: rows }),
      ).toThrow(message);
    });

    it('limits the text above buttons to 640 characters', () => {
      expect(() =>
        buildMessage({
          message_type: 'buttons',
          text: 'x'.repeat(641),
          buttons: [{ type: 'postback', title: 't', payload: 'p' }],
        }),
      ).toThrow('limited to 640');
    });

    it('builds an attachment from a link', () => {
      expect(
        buildMessage({
          message_type: 'attachment',
          attachment_type: 'image',
          attachment_url: 'https://cdn.test/a.png',
        }),
      ).toEqual({
        attachment: {
          type: 'image',
          payload: { url: 'https://cdn.test/a.png', is_reusable: true },
        },
      });
      expect(() =>
        buildMessage({ message_type: 'attachment', attachment_url: '' }),
      ).toThrow('File URL is required');
      expect(() =>
        buildMessage({
          message_type: 'attachment',
          attachment_type: 'gif',
          attachment_url: 'https://cdn.test/a.gif',
        }),
      ).toThrow('not a file type');
    });

    it('rejects an unknown message type', () => {
      expect(() =>
        buildMessage({ message_type: 'carousel', text: 'x' }),
      ).toThrow('not a message type');
    });
  });

  describe('Send Message node', () => {
    it('describes lists as collections that are only shown for their message type', () => {
      const schema = nodeConfigSchema(send) as {
        properties: Record<string, Record<string, any>>;
      };
      expect(schema.properties.quick_replies.type).toBe('array');
      expect(schema.properties.quick_replies.items['x-propertyOrder']).toEqual([
        'title',
        'payload',
      ]);
      expect(
        schema.properties.quick_replies.items.properties.title[
          'x-allowExpression'
        ],
      ).toBe(true);
      expect(schema.properties.quick_replies['x-hideWhen']).toEqual({
        field: 'message_type',
        in: ['text', 'buttons', 'attachment'],
      });
      expect(
        schema.properties.buttons.items.properties.url['x-hideWhen'],
      ).toEqual({
        field: 'type',
        in: ['postback'],
      });
      expect(schema.properties.text['x-hideWhen']).toEqual({
        field: 'message_type',
        in: ['attachment'],
      });
    });

    it('has no expression as the default of a field that can be hidden', () => {
      const schema = nodeConfigSchema(send) as {
        properties: Record<string, Record<string, unknown>>;
      };
      for (const property of Object.values(schema.properties)) {
        const value = property.default;
        if (property['x-hideWhen'] && typeof value === 'string') {
          expect(value.includes('{{')).toBe(false);
        }
      }
    });

    it('sends quick replies through the chosen Page', async () => {
      const output = await send.execute({
        parameters: {
          page_id: 'page-1',
          recipient_id: 'customer-1',
          message_type: 'quick_replies',
          text: 'Bạn cần gì?',
          quick_replies: [{ title: 'Giá', payload: 'PRICE' }],
        },
        credential: messengerSecret(),
        item: { json: {} },
      });
      expect(graph.sent).toEqual([
        {
          pageAccessToken: 'EAApage1',
          recipientId: 'customer-1',
          message: {
            text: 'Bạn cần gì?',
            quick_replies: [
              { content_type: 'text', title: 'Giá', payload: 'PRICE' },
            ],
          },
        },
      ]);
      expect(output).toMatchObject({ status: 'sent', message_id: 'mid.1' });
    });
  });

  describe('Sender Action node', () => {
    const run = (parameters: Record<string, unknown>) =>
      action.execute({
        parameters: {
          page_id: 'page-2',
          recipient_id: ' customer-1 ',
          ...parameters,
        },
        credential: messengerSecret(),
        item: { json: {} },
      });

    it('shows typing by default, with the token of the chosen Page', async () => {
      expect(await run({})).toEqual({
        page_id: 'page-2',
        recipient_id: 'customer-1',
        action: 'typing_on',
        status: 'sent',
      });
      expect(graph.actions).toEqual([
        {
          pageAccessToken: 'EAApage2',
          recipientId: 'customer-1',
          action: 'typing_on',
        },
      ]);
    });

    it('can mark the message as seen', async () => {
      await run({ action: 'mark_seen' });
      expect(graph.actions[0].action).toBe('mark_seen');
    });

    it('refuses an unknown action and a Page that was not granted', async () => {
      await expect(run({ action: 'dance' })).rejects.toThrow(
        'not a sender action',
      );
      await expect(run({ page_id: 'page-9' })).rejects.toThrow(
        'Page page-9 is not connected',
      );
      expect(graph.actions).toEqual([]);
    });
  });
});
