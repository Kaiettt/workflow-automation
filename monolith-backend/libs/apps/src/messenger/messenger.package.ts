import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  ActionNode,
  CredentialType,
  IntegrationPackage,
  NodeProperty,
  TriggerEvent,
  TriggerNode,
  WebhookLifecycleContext,
} from '../core/package';
import { header, matchesKeywords } from '../core/text';
import { GRAPH_VERSION, MetaGraphApi, SenderAction } from './meta-graph.api';

export const MESSENGER_CREDENTIAL = 'facebookMessengerOAuth2';
const MAX_TEXT_LENGTH = 2000;
// Send API limits: https://developers.facebook.com/docs/messenger-platform/send-messages
const MAX_QUICK_REPLIES = 13;
const MAX_BUTTONS = 3;
const MAX_TITLE_LENGTH = 20;
const MAX_BUTTON_TEXT_LENGTH = 640;
const MAX_PAYLOAD_LENGTH = 1000;
// What the Meta App and each Page are subscribed to: customer messages and
// clicks on buttons (postbacks).
const SUBSCRIBED_FIELDS = ['messages', 'messaging_postbacks'];

interface StoredPage {
  id: string;
  name: string;
  access_token: string;
}

interface MessagingEvent {
  sender?: { id?: unknown };
  timestamp?: unknown;
  message?: {
    mid?: unknown;
    text?: unknown;
    is_echo?: unknown;
    quick_reply?: { payload?: unknown };
    attachments?: Array<{ type?: unknown; payload?: { url?: unknown } }>;
  };
  postback?: { mid?: unknown; title?: unknown; payload?: unknown };
}

// Facebook Page messages through the user's own Meta App: App ID and App
// Secret are typed into the credential, the Page tokens come from OAuth.
export function createMessengerPackage(
  graph: MetaGraphApi,
): IntegrationPackage {
  const credential: CredentialType = {
    key: MESSENGER_CREDENTIAL,
    displayName: 'Facebook Messenger account',
    fields: [
      {
        name: 'client_id',
        displayName: 'App ID',
        description: 'Meta App dashboard → App settings → Basic',
      },
      { name: 'client_secret', displayName: 'App Secret', secret: true },
    ],
    oauth2: {
      authorizationUrl: `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`,
      // Read the user's Pages, send messages as them, subscribe them to the app.
      scopes: ['pages_show_list', 'pages_messaging', 'pages_manage_metadata'],
      scopeSeparator: ',',
      async exchangeCode({ code, redirectUri, values }) {
        const { appId, appSecret } = appOf(values);
        const shortToken = await graph.exchangeCode(
          appId,
          appSecret,
          code,
          redirectUri,
        );
        const longLived = await graph.exchangeLongLived(
          appId,
          appSecret,
          shortToken,
        );
        const pages = await graph.listPages(longLived.token);
        if (pages.length === 0) {
          throw new Error(
            'No Facebook Page was shared. Connect again and select at least one Page.',
          );
        }
        return {
          access_token: longLived.token,
          token_expires_at: longLived.expiresIn
            ? new Date(Date.now() + longLived.expiresIn * 1000).toISOString()
            : null,
          pages: pages.map((page): StoredPage => ({
            id: page.id,
            name: page.name,
            access_token: page.accessToken,
          })),
        };
      },
    },
  };

  const pageProperty: NodeProperty = {
    name: 'page_id',
    displayName: 'Page',
    type: 'options',
    required: true,
    description: 'Pages granted when the credential was connected',
    loadOptions: ({ credential: secret }) =>
      Promise.resolve(
        pagesOf(secret).map((page) => ({ value: page.id, label: page.name })),
      ),
  };

  const trigger: TriggerNode = {
    kind: 'trigger',
    key: 'messenger.trigger',
    displayName: 'Messenger Trigger',
    description: 'Start when a customer messages your Facebook Page',
    icon: 'message-circle',
    color: '#0084FF',
    credentialType: MESSENGER_CREDENTIAL,
    properties: [
      pageProperty,
      {
        name: 'events',
        displayName: 'Events',
        type: 'options',
        default: 'all',
        options: [
          { value: 'all', label: 'Messages and button clicks' },
          { value: 'message', label: 'Messages only' },
          { value: 'postback', label: 'Button clicks only' },
        ],
        description:
          'A button click (postback) starts the workflow with its payload',
      },
      {
        name: 'keywords',
        displayName: 'Keywords',
        type: 'string',
        placeholder: 'e.g. giá, bảng giá',
        description:
          'Optional. Only events whose text or payload contains one of these words (comma separated; case and accents do not matter). Empty: every event.',
      },
    ],
    webhook: {
      // One Meta App has a single callback URL for Page events.
      scope: 'credential',
      initialData: () => ({ verify_token: randomBytes(24).toString('hex') }),

      async checkExists(context) {
        const { appId, appToken } = appTokenOf(context.credential);
        const subscriptions = await graph.listAppSubscriptions(appId, appToken);
        const subscribed = subscriptions.some(
          (s) =>
            s.object === 'page' &&
            s.callbackUrl === context.url &&
            s.active &&
            hasAll(s.fields, SUBSCRIBED_FIELDS),
        );
        if (!subscribed) return false;
        for (const page of listenedPages(context)) {
          const apps = await graph.pageSubscribedApps(
            page.id,
            page.access_token,
          );
          const ours = apps.find((app) => app.id === appId);
          if (!ours || !hasAll(ours.fields, SUBSCRIBED_FIELDS)) return false;
        }
        return true;
      },

      async create(context) {
        const { appId, appToken } = appTokenOf(context.credential);
        await graph.subscribeApp(appId, appToken, {
          callbackUrl: context.url,
          verifyToken: asText(context.data.verify_token),
          fields: SUBSCRIBED_FIELDS,
        });
        const subscribed = new Set(stringList(context.data.pages));
        for (const page of listenedPages(context)) {
          await graph.subscribePage(
            page.id,
            page.access_token,
            SUBSCRIBED_FIELDS,
          );
          subscribed.add(page.id);
        }
        context.data.pages = [...subscribed];
      },

      async delete(context) {
        const { appId, appToken } = appTokenOf(context.credential);
        await graph.unsubscribeApp(appId, appToken);
        const pages = pagesOf(context.credential);
        for (const pageId of stringList(context.data.pages)) {
          const page = pages.find((candidate) => candidate.id === pageId);
          if (page) await graph.unsubscribePage(page.id, page.access_token);
        }
        context.data.pages = [];
      },

      handle({ request, credential: secret, data }) {
        if (request.method === 'GET') {
          // Meta's check while the subscription is created.
          const expected = data.verify_token;
          const challenge = request.query['hub.challenge'];
          const ok =
            request.query['hub.mode'] === 'subscribe' &&
            typeof expected === 'string' &&
            expected !== '' &&
            request.query['hub.verify_token'] === expected;
          return ok
            ? {
                status: 200,
                contentType: 'text/plain',
                body: typeof challenge === 'string' ? challenge : '',
                events: [],
              }
            : { status: 403, body: { success: false }, events: [] };
        }
        const appSecret = secret?.client_secret;
        if (
          !isValidMetaSignature(
            request.rawBody,
            header(request.headers, 'x-hub-signature-256'),
            typeof appSecret === 'string' ? appSecret : undefined,
          )
        ) {
          return {
            status: 401,
            body: { success: false, message: 'Invalid signature' },
            events: [],
          };
        }
        return { status: 200, events: parseMessengerEvents(request.body) };
      },

      accepts: (event, parameters) => {
        const wanted = parameters.events;
        const type = asText(event.json.type);
        return (
          event.json.page_id === parameters.page_id &&
          (wanted === undefined || wanted === 'all' || wanted === type) &&
          (matchesKeywords(asText(event.json.text), parameters.keywords) ||
            matchesKeywords(asText(event.json.payload), parameters.keywords))
        );
      },
    },
  };

  const recipientProperty: NodeProperty = {
    name: 'recipient_id',
    displayName: 'Recipient ID',
    type: 'string',
    required: true,
    expression: true,
    default: '{{$node["Messenger Trigger"].json.sender_id}}',
    description:
      'Page-scoped ID of the person, e.g. sender_id of the Messenger Trigger',
  };

  // Fields that belong to one message type are hidden for the others.
  const onlyFor = (...types: MessageType[]) => ({
    field: 'message_type',
    in: MESSAGE_TYPES.filter((type) => !types.includes(type)),
  });

  const sendMessage: ActionNode = {
    kind: 'action',
    key: 'messenger.sendMessage',
    displayName: 'Messenger Send Message',
    description:
      'Send a message from your Facebook Page: text, quick replies, buttons or an image / file',
    icon: 'send',
    color: '#0084FF',
    credentialType: MESSENGER_CREDENTIAL,
    properties: [
      pageProperty,
      recipientProperty,
      {
        name: 'message_type',
        displayName: 'Message type',
        type: 'options',
        default: 'text',
        options: [
          { value: 'text', label: 'Text' },
          { value: 'quick_replies', label: 'Text with quick replies' },
          { value: 'buttons', label: 'Text with buttons' },
          { value: 'attachment', label: 'Image, video, audio or file' },
        ],
      },
      {
        name: 'text',
        displayName: 'Text',
        type: 'string',
        expression: true,
        multiline: true,
        hideWhen: onlyFor('text', 'quick_replies', 'buttons'),
      },
      {
        name: 'quick_replies',
        displayName: 'Quick replies',
        type: 'collection',
        description: `Up to ${MAX_QUICK_REPLIES}; each one disappears once the customer taps it`,
        hideWhen: onlyFor('quick_replies'),
        fields: [
          {
            name: 'title',
            displayName: 'Title',
            type: 'string',
            expression: true,
            description: `Up to ${MAX_TITLE_LENGTH} characters`,
          },
          {
            name: 'payload',
            displayName: 'Payload',
            type: 'string',
            expression: true,
            placeholder: 'e.g. PRICE',
            description: 'Comes back in the payload of the Messenger Trigger',
          },
        ],
      },
      {
        name: 'buttons',
        displayName: 'Buttons',
        type: 'collection',
        description: `Up to ${MAX_BUTTONS}`,
        hideWhen: onlyFor('buttons'),
        fields: [
          {
            name: 'type',
            displayName: 'Type',
            type: 'options',
            default: 'postback',
            options: [
              { value: 'postback', label: 'Send a payload back' },
              { value: 'web_url', label: 'Open a link' },
            ],
          },
          {
            name: 'title',
            displayName: 'Title',
            type: 'string',
            expression: true,
            description: `Up to ${MAX_TITLE_LENGTH} characters`,
          },
          {
            name: 'payload',
            displayName: 'Payload',
            type: 'string',
            expression: true,
            hideWhen: { field: 'type', in: ['web_url'] },
          },
          {
            name: 'url',
            displayName: 'Link',
            type: 'string',
            expression: true,
            placeholder: 'https://',
            hideWhen: { field: 'type', in: ['postback'] },
          },
        ],
      },
      {
        name: 'attachment_type',
        displayName: 'File type',
        type: 'options',
        default: 'image',
        options: [
          { value: 'image', label: 'Image' },
          { value: 'video', label: 'Video' },
          { value: 'audio', label: 'Audio' },
          { value: 'file', label: 'File' },
        ],
        hideWhen: onlyFor('attachment'),
      },
      {
        name: 'attachment_url',
        displayName: 'File URL',
        type: 'string',
        expression: true,
        placeholder: 'https://',
        description: 'A public link Messenger can download from',
        hideWhen: onlyFor('attachment'),
      },
    ],
    async execute({ parameters, credential: secret }) {
      const page = pageOf(secret, parameters);
      const message = buildMessage(parameters);
      const recipientId = asText(parameters.recipient_id).trim();
      const { messageId } = await graph.sendMessage(
        page.access_token,
        recipientId,
        message,
      );
      return {
        page_id: page.id,
        recipient_id: recipientId,
        message_id: messageId,
        status: 'sent',
      };
    },
  };

  const senderAction: ActionNode = {
    kind: 'action',
    key: 'messenger.senderAction',
    displayName: 'Messenger Sender Action',
    description:
      'Show "typing…" or mark the customer’s message as seen while the bot works',
    icon: 'ellipsis',
    color: '#0084FF',
    credentialType: MESSENGER_CREDENTIAL,
    properties: [
      pageProperty,
      recipientProperty,
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'typing_on',
        options: [
          { value: 'typing_on', label: 'Show typing…' },
          { value: 'typing_off', label: 'Hide typing' },
          { value: 'mark_seen', label: 'Mark as seen' },
        ],
      },
    ],
    async execute({ parameters, credential: secret }) {
      const page = pageOf(secret, parameters);
      const action = asText(parameters.action) || 'typing_on';
      if (!SENDER_ACTIONS.includes(action as SenderAction)) {
        throw new Error(`"${action}" is not a sender action`);
      }
      const recipientId = asText(parameters.recipient_id).trim();
      await graph.sendAction(
        page.access_token,
        recipientId,
        action as SenderAction,
      );
      return {
        page_id: page.id,
        recipient_id: recipientId,
        action,
        status: 'sent',
      };
    },
  };

  return {
    key: 'messenger',
    displayName: 'Facebook Messenger',
    credentials: [credential],
    nodes: [trigger, sendMessage, senderAction],
  };
}

const MESSAGE_TYPES = [
  'text',
  'quick_replies',
  'buttons',
  'attachment',
] as const;
type MessageType = (typeof MESSAGE_TYPES)[number];
const SENDER_ACTIONS: SenderAction[] = ['typing_on', 'typing_off', 'mark_seen'];
const ATTACHMENT_TYPES = ['image', 'video', 'audio', 'file'];

function hasAll(have: string[], wanted: string[]): boolean {
  return wanted.every((field) => have.includes(field));
}

function pageOf(
  secret: Record<string, unknown> | null,
  parameters: Record<string, unknown>,
): StoredPage {
  const pageId = asText(parameters.page_id);
  const page = pagesOf(secret).find((candidate) => candidate.id === pageId);
  if (!page) throw new Error(pageMissing(pageId));
  return page;
}

function rowsOf(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (row): row is Record<string, unknown> =>
          typeof row === 'object' && row !== null && !Array.isArray(row),
      )
    : [];
}

function limited(text: string, max: number, what: string): string {
  if (text.length > max) {
    throw new Error(`${what} is limited to ${max} characters`);
  }
  return text;
}

function required(text: string, what: string): string {
  if (!text.trim()) throw new Error(`${what} is required`);
  return text;
}

function httpUrl(raw: string, what: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(`${what} must be a link such as https://example.com`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${what} must start with http:// or https://`);
  }
  return url.toString();
}

// The Send API message object for the node's parameters.
export function buildMessage(
  parameters: Record<string, unknown>,
): Record<string, unknown> {
  const type = (asText(parameters.message_type) || 'text') as MessageType;
  if (!MESSAGE_TYPES.includes(type)) {
    throw new Error(`"${type}" is not a message type`);
  }

  if (type === 'attachment') {
    const kind = asText(parameters.attachment_type) || 'image';
    if (!ATTACHMENT_TYPES.includes(kind)) {
      throw new Error(`"${kind}" is not a file type`);
    }
    const url = httpUrl(
      required(asText(parameters.attachment_url), 'File URL'),
      'The file URL',
    );
    return { attachment: { type: kind, payload: { url, is_reusable: true } } };
  }

  const text = required(asText(parameters.text), 'Text');

  if (type === 'quick_replies') {
    limited(text, MAX_TEXT_LENGTH, 'A Messenger message');
    const rows = rowsOf(parameters.quick_replies);
    if (rows.length === 0) throw new Error('Add at least one quick reply');
    if (rows.length > MAX_QUICK_REPLIES) {
      throw new Error(`At most ${MAX_QUICK_REPLIES} quick replies are allowed`);
    }
    return {
      text,
      quick_replies: rows.map((row) => ({
        content_type: 'text',
        title: limited(
          required(asText(row.title), 'A quick reply title'),
          MAX_TITLE_LENGTH,
          'A quick reply title',
        ),
        payload: limited(
          required(asText(row.payload), 'A quick reply payload'),
          MAX_PAYLOAD_LENGTH,
          'A quick reply payload',
        ),
      })),
    };
  }

  if (type === 'buttons') {
    limited(text, MAX_BUTTON_TEXT_LENGTH, 'The text above buttons');
    const rows = rowsOf(parameters.buttons);
    if (rows.length === 0) throw new Error('Add at least one button');
    if (rows.length > MAX_BUTTONS) {
      throw new Error(`At most ${MAX_BUTTONS} buttons are allowed`);
    }
    const buttons = rows.map((row) => {
      const title = limited(
        required(asText(row.title), 'A button title'),
        MAX_TITLE_LENGTH,
        'A button title',
      );
      return asText(row.type) === 'web_url'
        ? {
            type: 'web_url',
            title,
            url: httpUrl(
              required(asText(row.url), 'A button link'),
              'A button link',
            ),
          }
        : {
            type: 'postback',
            title,
            payload: limited(
              required(asText(row.payload), 'A button payload'),
              MAX_PAYLOAD_LENGTH,
              'A button payload',
            ),
          };
    });
    return {
      attachment: {
        type: 'template',
        payload: { template_type: 'button', text, buttons },
      },
    };
  }

  limited(text, MAX_TEXT_LENGTH, 'A Messenger message');
  return { text };
}

function appOf(values: Record<string, unknown> | null) {
  const appId = values?.client_id;
  const appSecret = values?.client_secret;
  if (
    typeof appId !== 'string' ||
    !appId ||
    typeof appSecret !== 'string' ||
    !appSecret
  ) {
    throw new Error(
      'The credential needs the App ID and App Secret of your Meta App',
    );
  }
  return { appId, appSecret };
}

function appTokenOf(values: Record<string, unknown> | null) {
  const { appId, appSecret } = appOf(values);
  return { appId, appToken: `${appId}|${appSecret}` };
}

function pagesOf(secret: Record<string, unknown> | null): StoredPage[] {
  const pages = secret?.pages;
  if (!Array.isArray(pages)) return [];
  return (pages as Array<Partial<StoredPage> | null>).filter(
    (page): page is StoredPage =>
      typeof page?.id === 'string' &&
      typeof page?.name === 'string' &&
      typeof page?.access_token === 'string',
  );
}

// A parameter as text; anything that is not a string or number is blank.
function asText(value: unknown): string {
  return typeof value === 'string'
    ? value
    : typeof value === 'number'
      ? String(value)
      : '';
}

function pageMissing(pageId: string): string {
  return pageId
    ? `Page ${pageId} is not connected to this credential. Reconnect the credential and grant the Page.`
    : 'Choose a Page';
}

// Pages the listeners use, with their tokens.
function listenedPages(context: WebhookLifecycleContext): StoredPage[] {
  const pages = pagesOf(context.credential);
  const wanted = new Set(
    context.listeners
      .map((listener) => listener.page_id)
      .filter((id): id is string => typeof id === 'string' && id !== ''),
  );
  return [...wanted].map((pageId) => {
    const page = pages.find((candidate) => candidate.id === pageId);
    if (!page) throw new Error(pageMissing(pageId));
    return page;
  });
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

// X-Hub-Signature-256 = "sha256=" + HMAC-SHA256 of the exact request bytes,
// keyed with the app secret.
export function isValidMetaSignature(
  rawBody: Buffer | undefined,
  signature: string | undefined,
  appSecret: string | undefined,
): boolean {
  if (!rawBody || !signature || !appSecret) return false;
  const expected = Buffer.from(
    `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`,
  );
  const received = Buffer.from(signature.trim());
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

// One event per message a customer sent or button they tapped. Echoes
// (messages the Page itself sent, including the bot's replies), deliveries and
// reads are dropped, so a reply never starts a workflow again.
export function parseMessengerEvents(body: unknown): TriggerEvent[] {
  const payload = body as { object?: unknown; entry?: unknown } | null;
  if (payload?.object !== 'page' || !Array.isArray(payload.entry)) return [];

  const events: TriggerEvent[] = [];
  for (const entry of payload.entry as Array<{
    id?: unknown;
    messaging?: unknown;
  }>) {
    if (typeof entry?.id !== 'string' || !Array.isArray(entry.messaging)) {
      continue;
    }
    for (const event of entry.messaging as MessagingEvent[]) {
      const senderId = event?.sender?.id;
      if (typeof senderId !== 'string') continue;
      const timestamp =
        typeof event.timestamp === 'number'
          ? new Date(event.timestamp).toISOString()
          : null;

      const postback = event.postback;
      if (postback && typeof postback.payload === 'string') {
        // The same tap is delivered again with the same mid, or, without one,
        // at the same time with the same payload.
        const mid = typeof postback.mid === 'string' ? postback.mid : null;
        events.push({
          id:
            mid ??
            `postback:${entry.id}:${senderId}:${String(event.timestamp)}:${postback.payload}`,
          json: {
            type: 'postback',
            message_id: mid,
            sender_id: senderId,
            page_id: entry.id,
            text: typeof postback.title === 'string' ? postback.title : '',
            payload: postback.payload,
            attachments: [],
            timestamp,
            raw: event,
          },
        });
        continue;
      }

      const message = event?.message;
      if (
        !message ||
        message.is_echo === true ||
        typeof message.mid !== 'string'
      ) {
        continue;
      }
      const quickReply = message.quick_reply?.payload;
      events.push({
        id: message.mid,
        json: {
          type: 'message',
          message_id: message.mid,
          sender_id: senderId,
          page_id: entry.id,
          text: typeof message.text === 'string' ? message.text : '',
          // Set when the customer tapped one of the quick replies.
          payload: typeof quickReply === 'string' ? quickReply : null,
          attachments: (message.attachments ?? []).map((attachment) => ({
            type: typeof attachment?.type === 'string' ? attachment.type : null,
            url:
              typeof attachment?.payload?.url === 'string'
                ? attachment.payload.url
                : null,
          })),
          timestamp,
          raw: event,
        },
      });
    }
  }
  return events;
}
