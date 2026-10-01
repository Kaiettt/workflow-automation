import { google } from 'googleapis';
import { INodeExecutor } from './node-executor';

export interface GmailSendConfig {
  credential_id: string;
  subject: string;
  body: string;
}

export interface GmailRecipient {
  name: string;
  email: string;
}

export type GmailClientFactory = (credential: unknown) => {
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
  readonly key = 'integration.gmail.send';

  constructor(
    private readonly gmailClientFactory: GmailClientFactory = (credential) => {
      const auth = new google.auth.OAuth2(
        process.env['google-Client-Id'],
        process.env['google-Client-secret'],
      );
      auth.setCredentials(credential as Record<string, unknown>);
      return google.gmail({ version: 'v1', auth });
    },
  ) {}

  parseConfig(raw: unknown): GmailSendConfig {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(
        'Gmail config must include credential_id, subject, and body',
      );
    }

    const config = raw as Record<string, unknown>;
    if (
      typeof config.credential_id !== 'string' ||
      config.credential_id.length === 0
    ) {
      throw new Error('Gmail config.credential_id is required');
    }
    if (typeof config.subject !== 'string' || config.subject.length === 0) {
      throw new Error('Gmail config.subject is required');
    }
    if (typeof config.body !== 'string' || config.body.length === 0) {
      throw new Error('Gmail config.body is required');
    }

    return {
      credential_id: config.credential_id,
      subject: config.subject,
      body: config.body,
    };
  }

  parseInput(raw: unknown): GmailRecipient[] {
    if (!Array.isArray(raw)) {
      throw new Error('Gmail input must be an array of recipients');
    }

    return raw.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`Gmail recipient at index ${index} must be an object`);
      }
      const recipient = item as Record<string, unknown>;
      if (
        typeof recipient.name !== 'string' ||
        recipient.name.trim().length === 0
      ) {
        throw new Error(`Gmail recipient at index ${index} is missing name`);
      }
      if (
        typeof recipient.email !== 'string' ||
        recipient.email.trim().length === 0
      ) {
        throw new Error(`Gmail recipient at index ${index} is missing email`);
      }
      return {
        name: recipient.name,
        email: recipient.email,
      };
    });
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

    const googleCredential = params.credential as {
      access_token?: string;
      refresh_token?: string;
    } | null;
    if (!googleCredential || typeof googleCredential !== 'object') {
      throw new Error('Gmail credential is missing');
    }

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
