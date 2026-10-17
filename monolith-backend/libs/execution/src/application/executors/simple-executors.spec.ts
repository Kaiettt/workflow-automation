import { AggregateExecutor } from './aggregate-executor';
import { GmailSendExecutor } from './gmail-send-executor';
import { GoogleSheetReadRowsExecutor } from './google-sheet-read-rows-executor';
import { ManualTriggerExecutor } from './manual-trigger-executor';

describe('ManualTriggerExecutor', () => {
  it('emits a single empty item to start the flow', async () => {
    const executor = new ManualTriggerExecutor();
    expect(executor.runMode).toBe('once');
    expect(await executor.execute()).toEqual([{ json: {} }]);
  });
});

describe('AggregateExecutor', () => {
  const executor = new AggregateExecutor();
  const items = [{ json: { n: 1 } }, { json: { n: 2 } }, { json: { n: 3 } }];

  it('combines every item into one item under "items" by default', async () => {
    const config = executor.parseConfig({});
    expect(await executor.execute({ config, items, credential: null })).toEqual(
      [{ json: { items: [{ n: 1 }, { n: 2 }, { n: 3 }] } }],
    );
  });

  it('uses the configured field name', async () => {
    const config = executor.parseConfig({ field: 'rows' });
    const [item] = await executor.execute({ config, items, credential: null });
    expect(Object.keys(item.json)).toEqual(['rows']);
  });

  it('returns one item with an empty list when there is no input', async () => {
    const config = executor.parseConfig({});
    expect(
      await executor.execute({ config, items: [], credential: null }),
    ).toEqual([{ json: { items: [] } }]);
  });

  it('does not pair its output with an input item', async () => {
    const config = executor.parseConfig({});
    const [item] = await executor.execute({ config, items, credential: null });
    expect(item.pairedItem).toBeUndefined();
  });
});

describe('GoogleSheetReadRowsExecutor', () => {
  const config = {
    credential_id: 'c',
    spreadsheet_id: 's',
    sheet_name: 'Sheet1',
  };
  const credential = { refresh_token: 'rt' };

  const executorWith = (values: unknown[][] | undefined) =>
    new GoogleSheetReadRowsExecutor(() => ({
      spreadsheets: {
        values: { get: jest.fn().mockResolvedValue({ data: { values } }) },
      },
    }));

  it('emits one item per data row keyed by the header row', async () => {
    const executor = executorWith([
      ['name', 'email'],
      ['Kiet', 'kiet@gmail.com'],
      ['An'],
    ]);
    expect(await executor.execute({ config, items: [], credential })).toEqual([
      { json: { name: 'Kiet', email: 'kiet@gmail.com' } },
      { json: { name: 'An', email: '' } },
    ]);
  });

  it('emits nothing for an empty sheet', async () => {
    expect(
      await executorWith(undefined).execute({ config, items: [], credential }),
    ).toEqual([]);
  });

  it('ignores incoming items and requires a Google connector', () => {
    const executor = executorWith([]);
    expect(executor.runMode).toBe('once');
    expect(executor.expectedConnectorKey()).toBe('google');
  });

  it('redacts tokens from Google errors', async () => {
    const executor = new GoogleSheetReadRowsExecutor(() => ({
      spreadsheets: {
        values: {
          get: jest.fn().mockRejectedValue(new Error('bad refresh_token abc')),
        },
      },
    }));
    await expect(
      executor.execute({ config, items: [], credential }),
    ).rejects.toThrow('bad [REDACTED] abc');
  });
});

describe('GmailSendExecutor', () => {
  const credential = { refresh_token: 'rt' };
  const baseConfig = {
    credential_id: 'c',
    to: 'kiet@gmail.com',
    subject: 'Hi',
    body: 'Body text',
  };

  const sentMessages = () => {
    const send = jest.fn().mockResolvedValue({ data: { id: 'msg-1' } });
    const executor = new GmailSendExecutor(() => ({
      users: { messages: { send } },
    }));
    const decode = (callIndex = 0): string => {
      const calls = send.mock.calls as Array<
        [{ requestBody: { raw: string } }]
      >;
      return Buffer.from(
        calls[callIndex][0].requestBody.raw,
        'base64url',
      ).toString();
    };
    return { send, executor, decode };
  };

  it('sends one email for the item and reports the result', async () => {
    const { send, executor, decode } = sentMessages();
    const result = await executor.executeItem({
      config: executor.parseConfig(baseConfig),
      item: { json: {} },
      credential,
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      to: 'kiet@gmail.com',
      status: 'sent',
      message_id: 'msg-1',
    });
    expect(decode()).toContain('To: kiet@gmail.com');
    expect(decode()).toContain('Subject: Hi');
    expect(decode()).toContain('Body text');
  });

  it('encodes a non-ASCII subject and body so they are not garbled', async () => {
    const { executor, decode } = sentMessages();
    await executor.executeItem({
      config: executor.parseConfig({
        ...baseConfig,
        subject: 'Chúc bạn một ngày tốt lành',
        body: 'Chào bạn,\nTrân trọng',
      }),
      item: { json: {} },
      credential,
    });
    const message = decode();
    const subject = /^Subject: =\?UTF-8\?B\?(.+)\?=$/m.exec(message);
    expect(Buffer.from(subject![1], 'base64').toString()).toBe(
      'Chúc bạn một ngày tốt lành',
    );
    const encodedBody = message.split('\r\n\r\n')[1].replace(/\r\n/g, '');
    expect(message).toContain('Content-Transfer-Encoding: base64');
    expect(Buffer.from(encodedBody, 'base64').toString()).toBe(
      'Chào bạn,\nTrân trọng',
    );
  });

  it('strips line breaks so a resolved value cannot inject headers', async () => {
    const { executor, decode } = sentMessages();
    await executor.executeItem({
      config: executor.parseConfig({
        ...baseConfig,
        subject: 'Hello\r\nBcc: evil@x.com',
      }),
      item: { json: {} },
      credential,
    });
    expect(decode()).toContain('Subject: Hello Bcc: evil@x.com');
    expect(decode()).not.toMatch(/^Bcc:/m);
  });

  it('rejects an empty recipient with a clear message', () => {
    const { executor } = sentMessages();
    expect(() => executor.parseConfig({ ...baseConfig, to: '  ' })).toThrow(
      /config\.to must resolve/,
    );
  });

  it('requires a Google credential', () => {
    const { executor } = sentMessages();
    expect(executor.runMode).toBe('per_item');
    expect(executor.expectedConnectorKey()).toBe('google');
  });

  it('rejects a credential without a refresh token', async () => {
    const { executor } = sentMessages();
    await expect(
      executor.executeItem({
        config: executor.parseConfig(baseConfig),
        item: { json: {} },
        credential: {},
      }),
    ).rejects.toThrow();
  });
});
