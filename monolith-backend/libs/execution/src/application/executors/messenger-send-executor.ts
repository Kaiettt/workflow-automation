import { z } from 'zod';
import { IPerItemExecutor } from '../../domain/entities/node-executor';
import {
  ConnectorKeys,
  MessengerLimits,
  NodeKeys,
} from '../../domain/constants/execution.constants';
import { Item, ItemJson } from '../../domain/models/item';
import {
  MessengerApiError,
  MessengerClient,
} from '../ports/messenger-client.port';
import { Sleep } from './llm-generate-executor';

const ConfigSchema = z.object({
  credential_id: z.string().min(1),
  recipient_id: z
    .string()
    .trim()
    .min(1, 'Messenger config.recipient_id must resolve to a customer id'),
  text: z
    .string()
    .trim()
    .min(1, 'Messenger config.text must not be empty')
    .max(
      MessengerLimits.MAX_TEXT_LENGTH,
      `Messenger messages are limited to ${MessengerLimits.MAX_TEXT_LENGTH} characters`,
    ),
});

export type MessengerSendConfig = z.infer<typeof ConfigSchema>;

const CredentialSchema = z.object({
  page_id: z.string().min(1),
  page_access_token: z.string().min(1),
});

const defaultSleep: Sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Sends one text message per item from the Page of the credential.
export class MessengerSendExecutor implements IPerItemExecutor<MessengerSendConfig> {
  readonly key = NodeKeys.MESSENGER_SEND;
  readonly runMode = 'per_item' as const;

  constructor(
    private readonly client: MessengerClient,
    private readonly sleep: Sleep = defaultSleep,
  ) {}

  parseConfig(raw: unknown): MessengerSendConfig {
    return ConfigSchema.parse(raw);
  }

  expectedConnectorKey(): string {
    return ConnectorKeys.MESSENGER;
  }

  async executeItem(params: {
    config: MessengerSendConfig;
    item: Item;
    credential: unknown;
  }): Promise<ItemJson> {
    const { page_access_token: pageAccessToken } = CredentialSchema.parse(
      params.credential,
    );
    const { recipient_id: recipientId, text } = params.config;

    const { messageId } = await this.sendWithRetry(() =>
      this.client.sendText({ pageAccessToken, recipientId, text }),
    );
    return { recipient_id: recipientId, message_id: messageId, status: 'sent' };
  }

  private async sendWithRetry<T>(attempt: () => Promise<T>): Promise<T> {
    for (let retry = 0; ; retry += 1) {
      try {
        return await attempt();
      } catch (error) {
        const retryable = error instanceof MessengerApiError && error.retryable;
        if (!retryable || retry >= MessengerLimits.MAX_RETRIES) throw error;
        await this.sleep(1000 * 2 ** retry);
      }
    }
  }
}
