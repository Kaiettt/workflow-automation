import axios, { AxiosError } from 'axios';
import { MessengerLimits } from '../../domain/constants/execution.constants';
import {
  MessengerApiError,
  MessengerClient,
  MessengerSendRequest,
} from '../../application/ports/messenger-client.port';

const DEFAULT_GRAPH_VERSION = 'v23.0';

interface GraphError {
  message?: string;
  code?: number;
  error_subcode?: number;
}

// Send API of the Facebook Graph API: POST /{version}/me/messages.
export class GraphMessengerClient implements MessengerClient {
  async sendText(
    request: MessengerSendRequest,
  ): Promise<{ messageId: string }> {
    const version = process.env['META_GRAPH_VERSION'] || DEFAULT_GRAPH_VERSION;
    try {
      const response = await axios.post<{ message_id?: string }>(
        `https://graph.facebook.com/${version}/me/messages`,
        {
          recipient: { id: request.recipientId },
          // A reply to a message the customer sent (allowed for 24 hours).
          messaging_type: 'RESPONSE',
          message: { text: request.text },
        },
        {
          params: { access_token: request.pageAccessToken },
          timeout: MessengerLimits.REQUEST_TIMEOUT_MS,
        },
      );
      return { messageId: response.data.message_id ?? '' };
    } catch (error) {
      throw toMessengerError(error);
    }
  }
}

// Rate limits, timeouts and 5xx are retryable; Graph explains everything else.
export function toMessengerError(error: unknown): MessengerApiError {
  if (!(error instanceof AxiosError)) {
    return new MessengerApiError(
      error instanceof Error ? error.message : 'Messenger request failed',
      false,
    );
  }
  if (!error.response) {
    // No answer: timeout or network problem.
    return new MessengerApiError(
      `Messenger did not answer (${error.code ?? 'network error'})`,
      true,
    );
  }

  const status = error.response.status;
  const graph = (error.response.data as { error?: GraphError } | undefined)
    ?.error;
  const code = graph?.code;
  if (code === 10 && graph?.error_subcode === 2018278) {
    return new MessengerApiError(
      'Messenger only allows replies within 24 hours of the customer’s last message',
      false,
    );
  }
  if (code === 551) {
    return new MessengerApiError(
      'This person is not available on Messenger right now',
      false,
    );
  }
  if (code === 190) {
    return new MessengerApiError(
      'The Page Access Token is invalid or expired; connect the Page again',
      false,
    );
  }
  const rateLimited = code === 4 || code === 32 || code === 613;
  return new MessengerApiError(
    `Messenger API error (${status}): ${graph?.message ?? error.message}`,
    status === 429 || status >= 500 || rateLimited,
  );
}
