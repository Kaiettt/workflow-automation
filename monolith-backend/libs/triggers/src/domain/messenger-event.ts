import { createHmac, timingSafeEqual } from 'node:crypto';

// Meta signs every webhook call: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256
// of the exact request bytes, keyed with the app secret.
export function isValidMetaSignature(
  rawBody: Buffer | undefined,
  header: string | undefined,
  appSecret: string | undefined,
): boolean {
  if (!rawBody || !header || !appSecret) return false;
  const expected = Buffer.from(
    `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`,
  );
  const received = Buffer.from(header.trim());
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

export interface MessengerMessage {
  pageId: string;
  messageId: string;
  item: { json: Record<string, unknown> };
}

interface MessagingEvent {
  sender?: { id?: unknown };
  recipient?: { id?: unknown };
  timestamp?: unknown;
  message?: {
    mid?: unknown;
    text?: unknown;
    is_echo?: unknown;
    attachments?: Array<{ type?: unknown; payload?: { url?: unknown } }>;
  };
}

// One item per message a customer sent. Echoes (messages the Page itself sent,
// including the bot's replies), deliveries, reads and other events are dropped,
// so a reply can never start the workflow again.
export function parseMessengerMessages(body: unknown): MessengerMessage[] {
  const payload = body as { object?: unknown; entry?: unknown } | null;
  if (payload?.object !== 'page' || !Array.isArray(payload.entry)) return [];

  const messages: MessengerMessage[] = [];
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
      messages.push({
        pageId: entry.id,
        messageId: message.mid,
        item: {
          json: {
            channel: 'messenger',
            message_id: message.mid,
            sender_id: senderId,
            recipient_id:
              typeof event.recipient?.id === 'string'
                ? event.recipient.id
                : entry.id,
            text: typeof message.text === 'string' ? message.text : '',
            attachments: (message.attachments ?? []).map((attachment) => ({
              type:
                typeof attachment?.type === 'string' ? attachment.type : null,
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
        },
      });
    }
  }
  return messages;
}
