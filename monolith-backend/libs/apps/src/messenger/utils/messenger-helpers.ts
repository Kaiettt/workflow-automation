import { TriggerEvent, WebhookLifecycleContext } from '../../core/package';

export interface StoredPage {
  id: string;
  name: string;
  access_token: string;
}

export interface MessagingEvent {
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

export function hasAll(have: string[], wanted: string[]): boolean {
  return wanted.every((field) => have.includes(field));
}

export function pageOf(
  secret: Record<string, unknown> | null,
  parameters: Record<string, unknown>,
): StoredPage {
  const pageId = asText(parameters.page_id);
  const page = pagesOf(secret).find((candidate) => candidate.id === pageId);
  if (!page) throw new Error(pageMissing(pageId));
  return page;
}

export function rowsOf(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (row): row is Record<string, unknown> =>
          typeof row === 'object' && row !== null && !Array.isArray(row),
      )
    : [];
}

export function limited(text: string, max: number, what: string): string {
  if (text.length > max) {
    throw new Error(`${what} is limited to ${max} characters`);
  }
  return text;
}

export function required(text: string, what: string): string {
  if (!text.trim()) throw new Error(`${what} is required`);
  return text;
}

export function httpUrl(raw: string, what: string): string {
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

export function appOf(values: Record<string, unknown> | null) {
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

export function appTokenOf(values: Record<string, unknown> | null) {
  const { appId, appSecret } = appOf(values);
  return { appId, appToken: `${appId}|${appSecret}` };
}

export function pagesOf(secret: Record<string, unknown> | null): StoredPage[] {
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
export function asText(value: unknown): string {
  return typeof value === 'string'
    ? value
    : typeof value === 'number'
      ? String(value)
      : '';
}

export function pageMissing(pageId: string): string {
  return pageId
    ? `Page ${pageId} is not connected to this credential. Reconnect the credential and grant the Page.`
    : 'Choose a Page';
}

// Pages the listeners use, with their tokens.
export function listenedPages(context: WebhookLifecycleContext): StoredPage[] {
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

export function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
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
