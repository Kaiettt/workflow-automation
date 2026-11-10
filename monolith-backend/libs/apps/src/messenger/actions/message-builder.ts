import {
  asText,
  httpUrl,
  limited,
  required,
  rowsOf,
} from '../utils/messenger-helpers';

export const MAX_TEXT_LENGTH = 2000;
// Send API limits: https://developers.facebook.com/docs/messenger-platform/send-messages
export const MAX_QUICK_REPLIES = 13;
export const MAX_BUTTONS = 3;
export const MAX_TITLE_LENGTH = 20;
export const MAX_BUTTON_TEXT_LENGTH = 640;
export const MAX_PAYLOAD_LENGTH = 1000;

export const MESSAGE_TYPES = [
  'text',
  'quick_replies',
  'buttons',
  'attachment',
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];
export const ATTACHMENT_TYPES = ['image', 'video', 'audio', 'file'];

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
