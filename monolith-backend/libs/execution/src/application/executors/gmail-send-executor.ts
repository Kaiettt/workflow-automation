import { z } from 'zod';
import { google } from 'googleapis';
import { IPerItemExecutor } from '../../domain/entities/node-executor';
import {
  ConnectorKeys,
  NodeKeys,
} from '../../domain/constants/execution.constants';
import { Item, ItemJson } from '../../domain/models/item';

const ConfigSchema = z.object({
  credential_id: z.string().min(1),
  to: z
    .string()
    .trim()
    .min(1, 'Gmail config.to must resolve to a non-empty email address'),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export type GmailSendConfig = z.infer<typeof ConfigSchema>;

const CredentialSchema = z
  .object({
    refresh_token: z.string().min(1),
  })
  .passthrough();

export type GmailClientFactory = (credential: { refresh_token: string }) => {
  users: {
    messages: {
      send: (args: {
        userId: string;
        requestBody: { raw: string };
      }) => Promise<unknown>;
    };
  };
};

export class GmailSendExecutor implements IPerItemExecutor<GmailSendConfig> {
  readonly key = NodeKeys.GMAIL_SEND;
  readonly runMode = 'per_item' as const;
  readonly configSchema = ConfigSchema;
  readonly credentialSchema = CredentialSchema;

  constructor(
    private readonly gmailClientFactory: GmailClientFactory = (credential) => {
      const auth = new google.auth.OAuth2(
        process.env['google-Client-Id'],
        process.env['google-Client-secret'],
      );
      auth.setCredentials({
        refresh_token: credential.refresh_token,
      });
      return google.gmail({ version: 'v1', auth });
    },
  ) {}

  parseConfig(raw: unknown): GmailSendConfig {
    return this.configSchema.parse(raw);
  }

  parseCredential(raw: unknown) {
    return this.credentialSchema.parse(raw);
  }

  expectedConnectorKey(): string {
    return ConnectorKeys.GOOGLE;
  }

  // Sends one email for the current item; to / subject / body are already resolved.
  async executeItem(params: {
    config: GmailSendConfig;
    item: Item;
    credential: unknown;
  }): Promise<ItemJson> {
    const googleCredential = this.parseCredential(params.credential);
    const gmail = this.gmailClientFactory(googleCredential);

    const to = stripLineBreaks(params.config.to);
    const subject = stripLineBreaks(params.config.subject);
    const body = params.config.body;
    const bodyIsAscii = isAscii(body);
    const raw = Buffer.from(
      [
        'Content-Type: text/plain; charset="UTF-8"',
        'MIME-Version: 1.0',
        `Content-Transfer-Encoding: ${bodyIsAscii ? '7bit' : 'base64'}`,
        `To: ${to}`,
        `Subject: ${encodeHeader(subject)}`,
        '',
        bodyIsAscii ? body : wrapBase64(Buffer.from(body).toString('base64')),
      ].join('\r\n'),
    ).toString('base64url');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return { to, status: 'sent', message_id: readMessageId(response) };
  }
}

// Header values must stay on one line, otherwise a resolved value could inject headers.
function stripLineBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function isAscii(value: string): boolean {
  return /^[\t\n\r\x20-\x7E]*$/.test(value);
}

// Non-ASCII header text must be sent as an RFC 2047 encoded word, or mail clients show mojibake.
function encodeHeader(value: string): string {
  return isAscii(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value).toString('base64')}?=`;
}

// A base64 body is limited to 76 characters per line.
function wrapBase64(value: string): string {
  return value.replace(/(.{76})/g, '$1\r\n');
}

function readMessageId(response: unknown): string | null {
  const data = (response as { data?: { id?: unknown } } | null)?.data;
  return typeof data?.id === 'string' ? data.id : null;
}
