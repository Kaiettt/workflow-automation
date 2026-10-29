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
import { GRAPH_VERSION, MetaGraphApi } from './meta-graph.api';

export const MESSENGER_CREDENTIAL = 'facebookMessengerOAuth2';
const MAX_TEXT_LENGTH = 2000;

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
    attachments?: Array<{ type?: unknown; payload?: { url?: unknown } }>;
  };
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
        name: 'keywords',
        displayName: 'Keywords',
        type: 'string',
        placeholder: 'e.g. giá, bảng giá',
        description:
          'Optional. Only messages containing one of these words (comma separated; case and accents do not matter). Empty: every message.',
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
            s.object === 'page' && s.callbackUrl === context.url && s.active,
        );
        if (!subscribed) return false;
        for (const page of listenedPages(context)) {
          const apps = await graph.pageSubscribedAppIds(
            page.id,
            page.access_token,
          );
          if (!apps.includes(appId)) return false;
        }
        return true;
      },

      async create(context) {
        const { appId, appToken } = appTokenOf(context.credential);
        await graph.subscribeApp(appId, appToken, {
          callbackUrl: context.url,
          verifyToken: asText(context.data.verify_token),
          fields: ['messages'],
        });
        const subscribed = new Set(stringList(context.data.pages));
        for (const page of listenedPages(context)) {
          await graph.subscribePage(page.id, page.access_token);
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

      accepts: (event, parameters) =>
        event.json.page_id === parameters.page_id &&
        matchesKeywords(asText(event.json.text), parameters.keywords),
    },
  };

  const sendMessage: ActionNode = {
    kind: 'action',
    key: 'messenger.sendMessage',
    displayName: 'Messenger Send Message',
    description: 'Send a text message from your Facebook Page',
    icon: 'send',
    color: '#0084FF',
    credentialType: MESSENGER_CREDENTIAL,
    properties: [
      pageProperty,
      {
        name: 'recipient_id',
        displayName: 'Recipient ID',
        type: 'string',
        required: true,
        expression: true,
        default: '{{$node["Messenger Trigger"].json.sender_id}}',
        description:
          'Page-scoped ID of the person, e.g. sender_id of the Messenger Trigger',
      },
      {
        name: 'text',
        displayName: 'Text',
        type: 'string',
        required: true,
        expression: true,
        multiline: true,
      },
    ],
    async execute({ parameters, credential: secret }) {
      const pageId = asText(parameters.page_id);
      const page = pagesOf(secret).find((candidate) => candidate.id === pageId);
      if (!page) throw new Error(pageMissing(pageId));
      const text = asText(parameters.text);
      if (text.length > MAX_TEXT_LENGTH) {
        throw new Error(
          `Messenger messages are limited to ${MAX_TEXT_LENGTH} characters`,
        );
      }
      const recipientId = asText(parameters.recipient_id).trim();
      const { messageId } = await graph.sendText(
        page.access_token,
        recipientId,
        text,
      );
      return {
        page_id: page.id,
        recipient_id: recipientId,
        message_id: messageId,
        status: 'sent',
      };
    },
  };

  return {
    key: 'messenger',
    displayName: 'Facebook Messenger',
    credentials: [credential],
    nodes: [trigger, sendMessage],
  };
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

// One event per message a customer sent. Echoes (messages the Page itself
// sent, including the bot's replies), deliveries and reads are dropped, so a
// reply never starts a workflow again.
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
      const message = event?.message;
      const senderId = event?.sender?.id;
      if (
        !message ||
        message.is_echo === true ||
        typeof message.mid !== 'string' ||
        typeof senderId !== 'string'
      ) {
        continue;
      }
      events.push({
        id: message.mid,
        json: {
          message_id: message.mid,
          sender_id: senderId,
          page_id: entry.id,
          text: typeof message.text === 'string' ? message.text : '',
          attachments: (message.attachments ?? []).map((attachment) => ({
            type: typeof attachment?.type === 'string' ? attachment.type : null,
            url:
              typeof attachment?.payload?.url === 'string'
                ? attachment.payload.url
                : null,
          })),
          timestamp:
            typeof event.timestamp === 'number'
              ? new Date(event.timestamp).toISOString()
              : null,
          raw: event,
        },
      });
    }
  }
  return events;
}
