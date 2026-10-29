import { AxiosError, AxiosHeaders } from 'axios';
import { MessengerSendExecutor } from '@app/execution/application/executors/messenger-send-executor';
import {
  MessengerApiError,
  MessengerClient,
  MessengerSendRequest,
} from '@app/execution/application/ports/messenger-client.port';
import { toMessengerError } from '@app/execution/infrastructure/messenger/graph-messenger.client';
import { sanitizeErrorText } from '@app/execution/application/services/node-runner';

const credential = {
  page_id: 'page-1',
  page_access_token: 'EAAtokentokentokentoken1',
};
const item = { json: {} };

class FakeClient implements MessengerClient {
  requests: MessengerSendRequest[] = [];
  constructor(private readonly replies: Array<Error | string> = []) {}
  sendText(request: MessengerSendRequest) {
    this.requests.push(request);
    const reply = this.replies.shift() ?? 'mid.1';
    return reply instanceof Error
      ? Promise.reject(reply)
      : Promise.resolve({ messageId: reply });
  }
}

function setup(replies: Array<Error | string> = []) {
  const client = new FakeClient(replies);
  const sleep = jest.fn(() => Promise.resolve());
  return { client, sleep, executor: new MessengerSendExecutor(client, sleep) };
}

const config = (overrides: Record<string, unknown> = {}) => ({
  credential_id: 'c',
  recipient_id: 'customer-1',
  text: 'Còn size M ạ',
  ...overrides,
});

describe('MessengerSendExecutor', () => {
  it('sends the text to the recipient with the Page token', async () => {
    const { executor, client } = setup();

    await expect(
      executor.executeItem({
        config: executor.parseConfig(config()),
        item,
        credential,
      }),
    ).resolves.toEqual({
      recipient_id: 'customer-1',
      message_id: 'mid.1',
      status: 'sent',
    });
    expect(client.requests).toEqual([
      {
        pageAccessToken: credential.page_access_token,
        recipientId: 'customer-1',
        text: 'Còn size M ạ',
      },
    ]);
  });

  it('requires a Messenger credential', () => {
    expect(setup().executor.expectedConnectorKey()).toBe('messenger');
  });

  it('rejects an empty recipient, empty text and text over 2000 characters', () => {
    const { executor } = setup();
    expect(() => executor.parseConfig(config({ recipient_id: ' ' }))).toThrow(
      'recipient_id',
    );
    expect(() => executor.parseConfig(config({ text: '' }))).toThrow(
      'must not be empty',
    );
    expect(() =>
      executor.parseConfig(config({ text: 'a'.repeat(2001) })),
    ).toThrow('2000 characters');
  });

  it('retries rate limits and outages with growing pauses', async () => {
    const { executor, client, sleep } = setup([
      new MessengerApiError('busy', true),
      new MessengerApiError('busy', true),
      'mid.3',
    ]);

    const result = await executor.executeItem({
      config: executor.parseConfig(config()),
      item,
      credential,
    });

    expect(result.message_id).toBe('mid.3');
    expect(client.requests).toHaveLength(3);
    expect(sleep.mock.calls).toEqual([[1000], [2000]]);
  });

  it('gives up after two retries and never retries a permanent error', async () => {
    const busy = setup([
      new MessengerApiError('busy', true),
      new MessengerApiError('busy', true),
      new MessengerApiError('still busy', true),
    ]);
    await expect(
      busy.executor.executeItem({
        config: busy.executor.parseConfig(config()),
        item,
        credential,
      }),
    ).rejects.toThrow('still busy');

    const closed = setup([new MessengerApiError('24 hours', false)]);
    await expect(
      closed.executor.executeItem({
        config: closed.executor.parseConfig(config()),
        item,
        credential,
      }),
    ).rejects.toThrow('24 hours');
    expect(closed.client.requests).toHaveLength(1);
  });
});

describe('toMessengerError', () => {
  const graphError = (status: number, error: Record<string, unknown>) =>
    new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status,
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { error },
    });

  it('explains the 24-hour window, unavailable users and bad tokens without retrying', () => {
    const window = toMessengerError(
      graphError(400, { code: 10, error_subcode: 2018278, message: 'x' }),
    );
    expect(window.message).toContain('24 hours');
    expect(window.retryable).toBe(false);
    expect(toMessengerError(graphError(400, { code: 551 })).message).toContain(
      'not available',
    );
    expect(toMessengerError(graphError(400, { code: 190 })).message).toContain(
      'Page Access Token',
    );
  });

  it('retries 429, 5xx, Graph rate limits and timeouts', () => {
    expect(toMessengerError(graphError(429, {})).retryable).toBe(true);
    expect(toMessengerError(graphError(503, {})).retryable).toBe(true);
    expect(toMessengerError(graphError(400, { code: 613 })).retryable).toBe(
      true,
    );
    expect(
      toMessengerError(new AxiosError('timeout', 'ECONNABORTED')).retryable,
    ).toBe(true);
    expect(
      toMessengerError(graphError(400, { code: 100, message: 'bad param' }))
        .retryable,
    ).toBe(false);
  });

  it('keeps Page tokens out of error messages', () => {
    expect(
      sanitizeErrorText('failed for EAAGm0PX4ZCpsBAHZBZCsomeLongToken123'),
    ).toBe('failed for [REDACTED]');
  });
});
