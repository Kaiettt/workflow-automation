import { z } from 'zod';
import { google } from 'googleapis';
import { INodeExecutor } from '../../domain/entities/node-executor';
import { NodeKeys } from '../../domain/constants/execution.constants';

const ConfigSchema = z.object({
  credential_id: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export type GmailSendConfig = z.infer<typeof ConfigSchema>;

const InputSchema = z.array(
  z.object({
    name: z.string().min(1),
    email: z.string().min(1),
  }),
);

export type GmailRecipient = z.infer<typeof InputSchema>[number];

const CredentialSchema = z.object({
  refresh_token: z.string().min(1),
}).passthrough();

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

export class GmailSendExecutor implements INodeExecutor<
  GmailSendConfig,
  GmailRecipient[],
  { sent_count: number; success_count: number; failed_count: number } | null
> {
  readonly key = NodeKeys.GMAIL_SEND;
  readonly configSchema = ConfigSchema;
  readonly inputSchema = InputSchema;
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

  parseInput(raw: unknown): GmailRecipient[] {
    return this.inputSchema.parse(raw);
  }

  parseCredential(raw: unknown) {
    return this.credentialSchema.parse(raw);
  }

  async execute(params: {
    config: GmailSendConfig;
    input: GmailRecipient[] | null;
    credential: unknown;
  }): Promise<{
    sent_count: number;
    success_count: number;
    failed_count: number;
  } | null> {
    if (!Array.isArray(params.input)) {
      throw new Error('Gmail input must be an array of recipients');
    }

    const googleCredential = this.parseCredential(params.credential);

    let sentCount = 0;
    let successCount = 0;
    let failedCount = 0;
    const gmail = this.gmailClientFactory(googleCredential);

    for (const recipient of params.input) {
      sentCount += 1;
      try {
        const subject = renderTemplate(params.config.subject, recipient);
        const body = renderTemplate(params.config.body, recipient);
        const encoded = Buffer.from(
          [
            'Content-Type: text/plain; charset="UTF-8"',
            'MIME-Version: 1.0',
            'Content-Transfer-Encoding: 7bit',
            `To: ${recipient.email}`,
            `Subject: ${subject}`,
            '',
            body,
          ].join('\r\n'),
        ).toString('base64url');

        await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encoded,
          },
        });
        successCount += 1;
      } catch (error) {
        failedCount += 1;
        const message =
          error instanceof Error ? error.message : 'Gmail send failed';
        const failure = new Error(sanitizeErrorText(message));
        const summary = {
          sent_count: sentCount,
          success_count: successCount,
          failed_count: failedCount,
        };
        (failure as Error & { summary?: unknown }).summary = summary;
        throw failure;
      }
    }

    const summary = {
      sent_count: sentCount,
      success_count: successCount,
      failed_count: failedCount,
    };

    return summary;
  }
}

function renderTemplate(template: string, recipient: GmailRecipient): string {
  return template
    .replace(/\{\{\s*name\s*\}\}/g, recipient.name)
    .replace(/\{\{\s*email\s*\}\}/g, recipient.email);
}

function sanitizeErrorText(message: string): string {
  return message
    .replace(
      /(access_token|refresh_token|token|encrypted_secret|ENCRYPTION_KEY|client_secret|Bearer [A-Za-z0-9._~+/=-]+)/gi,
      '[REDACTED]',
    )
    .replace(/\b[a-fA-F0-9]{32,}\b/g, '[REDACTED]');
}
