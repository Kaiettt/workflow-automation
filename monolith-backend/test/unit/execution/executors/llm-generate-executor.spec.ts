import { LLM_GENERATE_CONFIG_SCHEMA } from '../../../../prisma/mvp-node-schemas';
import { LlmLimits } from '@app/execution/domain/constants/execution.constants';
import {
  LlmGenerateExecutor,
  parseJsonOutput,
  parseMaxItemsCeiling,
} from '@app/execution/application/executors/llm-generate-executor';
import {
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmProvider,
  LlmProviderError,
} from '@app/execution/application/ports/llm-provider.port';
import { LlmProviderRegistry } from '@app/execution/application/services/llm-provider.registry';

type Reply = LlmGenerateResult | Error;

class FakeProvider implements LlmProvider {
  readonly requests: LlmGenerateRequest[] = [];
  private readonly replies: Reply[];

  constructor(
    readonly key: string,
    replies: Reply[] = [],
  ) {
    this.replies = replies;
  }

  generate(request: LlmGenerateRequest): Promise<LlmGenerateResult> {
    this.requests.push(request);
    const reply = this.replies.shift() ?? {
      text: 'ok',
      usage: { inputTokens: 1, outputTokens: 1 },
    };
    return reply instanceof Error
      ? Promise.reject(reply)
      : Promise.resolve(reply);
  }
}

const reply = (text: string): LlmGenerateResult => ({
  text,
  usage: { inputTokens: 12, outputTokens: 5 },
});

const baseConfig = {
  provider: 'openai',
  credential_id: 'cred',
  model: 'some-model',
  prompt: 'Say hi',
};

function setup(replies: Reply[] = [], ceiling = 500) {
  const provider = new FakeProvider('openai', replies);
  const sleeps: number[] = [];
  const executor = new LlmGenerateExecutor(
    new LlmProviderRegistry([provider]),
    ceiling,
    (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
  );
  const run = (
    config: Record<string, unknown> = {},
    credential: unknown = { api_key: 'sk-test' },
  ) =>
    executor.executeItem({
      config: executor.parseConfig({ ...baseConfig, ...config }),
      item: { json: {} },
      credential,
    });
  return { provider, executor, run, sleeps };
}

describe('LlmGenerateExecutor', () => {
  it('runs once per item and needs a credential of the chosen provider', () => {
    const { executor } = setup();
    expect(executor.runMode).toBe('per_item');
    expect(executor.expectedConnectorKey({ provider: 'anthropic' })).toBe(
      'anthropic',
    );
    expect(executor.expectedConnectorKey({ provider: 'gemini' })).toBe(
      'gemini',
    );
    expect(executor.expectedConnectorKey({ provider: 'nope' })).toBeNull();
    expect(executor.expectedConnectorKey({})).toBeNull();
  });

  describe('output', () => {
    it('returns the text, the model and the token usage', async () => {
      const { run } = setup([reply('Hello there')]);
      expect(await run()).toEqual({
        text: 'Hello there',
        model: 'some-model',
        usage: { input_tokens: 12, output_tokens: 5 },
      });
    });

    it('reports null usage when the provider gives none', async () => {
      const { run } = setup([{ text: 'x', usage: null }]);
      expect((await run()).usage).toBeNull();
    });

    it('parses JSON into "data" when output_format is json', async () => {
      const { run, provider } = setup([reply('{"label":"urgent"}')]);
      const output = await run({ output_format: 'json' });
      expect(output.data).toEqual({ label: 'urgent' });
      expect(output.text).toBe('{"label":"urgent"}');
      expect(provider.requests[0].outputFormat).toBe('json');
    });

    it('accepts JSON wrapped in a code fence', async () => {
      const { run } = setup([reply('```json\n{"a":1}\n```')]);
      expect((await run({ output_format: 'json' })).data).toEqual({ a: 1 });
    });

    it('fails when the model does not return valid JSON', async () => {
      const { run } = setup([reply('Sure! Here is your answer')]);
      await expect(run({ output_format: 'json' })).rejects.toThrow(
        'LLM returned invalid JSON',
      );
    });

    it('does not add "data" for text output', async () => {
      const { run } = setup([reply('{"a":1}')]);
      expect(await run()).not.toHaveProperty('data');
    });
  });

  describe('request sent to the provider', () => {
    it('passes the prompt, system prompt, model, limits and the API key', async () => {
      const { run, provider } = setup();
      await run(
        {
          system_prompt: 'Be brief',
          max_tokens: 300,
          temperature: 0.2,
        },
        { api_key: 'sk-abc' },
      );
      expect(provider.requests[0]).toEqual({
        model: 'some-model',
        systemPrompt: 'Be brief',
        prompt: 'Say hi',
        maxTokens: 300,
        temperature: 0.2,
        outputFormat: 'text',
        apiKey: 'sk-abc',
      });
    });

    it('uses 1024 max tokens and no temperature by default', async () => {
      const { run, provider } = setup();
      await run();
      expect(provider.requests[0].maxTokens).toBe(1024);
      expect(provider.requests[0].temperature).toBeUndefined();
      expect(provider.requests[0].systemPrompt).toBeUndefined();
    });

    it('accepts numbers sent as text by the form, and ignores blank optional fields', async () => {
      const { run, provider } = setup();
      await run({ max_tokens: '256', temperature: '0.5' });
      await run({ temperature: '', system_prompt: '' });
      expect(provider.requests[0].maxTokens).toBe(256);
      expect(provider.requests[0].temperature).toBe(0.5);
      expect(provider.requests[1].temperature).toBeUndefined();
      expect(provider.requests[1].systemPrompt).toBeUndefined();
    });

    it('turns a prompt that resolved to data into text', async () => {
      const { run, provider } = setup();
      await run({ prompt: { rows: [1, 2] } });
      await run({ prompt: 42 });
      expect(provider.requests[0].prompt).toBe('{"rows":[1,2]}');
      expect(provider.requests[1].prompt).toBe('42');
    });
  });

  describe('config validation', () => {
    const { executor } = setup();

    it.each([
      [{ prompt: '' }, /prompt must not be empty/],
      [{ prompt: null }, /prompt must not be empty/],
      [{ model: '  ' }, /model is required/],
      [{ provider: 'mistral' }, /provider/],
      [{ output_format: 'xml' }, /output_format/],
      [{ max_tokens: 0 }, /max_tokens/],
      [{ temperature: -1 }, /temperature/],
    ])('rejects %j', (override, message) => {
      expect(() =>
        executor.parseConfig({ ...baseConfig, ...override }),
      ).toThrow(message);
    });

    it('requires a credential with an API key', async () => {
      const { run } = setup();
      await expect(run({}, {})).rejects.toThrow();
      await expect(run({}, null)).rejects.toThrow();
    });
  });

  describe('retry', () => {
    const retryable = () => new LlmProviderError('rate limited', true);

    it('retries a retryable error and succeeds, pausing 1s then 2s', async () => {
      const { run, provider, sleeps } = setup([
        retryable(),
        retryable(),
        reply('finally'),
      ]);
      expect((await run()).text).toBe('finally');
      expect(provider.requests).toHaveLength(3);
      expect(sleeps).toEqual([1000, 2000]);
    });

    it('gives up after two retries', async () => {
      const { run, provider } = setup([
        retryable(),
        retryable(),
        retryable(),
        reply('never'),
      ]);
      await expect(run()).rejects.toThrow('rate limited');
      expect(provider.requests).toHaveLength(3);
    });

    it('does not retry an error that cannot succeed next time', async () => {
      const { run, provider, sleeps } = setup([
        new LlmProviderError('invalid api key', false),
        reply('never'),
      ]);
      await expect(run()).rejects.toThrow('invalid api key');
      expect(provider.requests).toHaveLength(1);
      expect(sleeps).toEqual([]);
    });

    it('does not retry an error that is not a provider error', async () => {
      const { run, provider } = setup([new Error('boom')]);
      await expect(run()).rejects.toThrow('boom');
      expect(provider.requests).toHaveLength(1);
    });
  });

  describe('maxItems', () => {
    it('defaults to 50 items', () => {
      const { executor } = setup();
      expect(executor.maxItems({})).toEqual({
        limit: 50,
        reason: "the node's max_items (50)",
      });
    });

    it("uses the node's max_items when it is within the platform ceiling", () => {
      const { executor } = setup([], 500);
      expect(executor.maxItems({ max_items: 200 }).limit).toBe(200);
      expect(executor.maxItems({ max_items: '75' }).limit).toBe(75);
    });

    it('caps the node at the platform ceiling and says which limit applies', () => {
      const { executor } = setup([], 100);
      expect(executor.maxItems({ max_items: 1000 })).toEqual({
        limit: 100,
        reason: 'the platform limit LLM_MAX_ITEMS (100)',
      });
    });

    it('falls back to the default when max_items is not a positive whole number', () => {
      const { executor } = setup();
      expect(executor.maxItems({ max_items: 'abc' }).limit).toBe(50);
      expect(executor.maxItems({ max_items: 0 }).limit).toBe(50);
      expect(executor.maxItems({ max_items: 2.5 }).limit).toBe(50);
    });
  });
});

describe('parseMaxItemsCeiling', () => {
  it.each([
    ['250', 250],
    [undefined, LlmLimits.DEFAULT_MAX_ITEMS_CEILING],
    ['', LlmLimits.DEFAULT_MAX_ITEMS_CEILING],
    ['abc', LlmLimits.DEFAULT_MAX_ITEMS_CEILING],
    ['0', LlmLimits.DEFAULT_MAX_ITEMS_CEILING],
    ['-5', LlmLimits.DEFAULT_MAX_ITEMS_CEILING],
    ['1.5', LlmLimits.DEFAULT_MAX_ITEMS_CEILING],
  ])('reads %p as %p', (raw, expected) => {
    expect(parseMaxItemsCeiling(raw)).toBe(expected);
  });
});

describe('parseJsonOutput', () => {
  it('parses plain, padded and fenced JSON', () => {
    expect(parseJsonOutput('[1,2]')).toEqual([1, 2]);
    expect(parseJsonOutput('  {"a":true}\n')).toEqual({ a: true });
    expect(parseJsonOutput('```\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonOutput('```JSON\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('rejects text that is not JSON without echoing it', () => {
    expect(() => parseJsonOutput('secret text')).toThrow(
      'LLM returned invalid JSON',
    );
  });
});

describe('catalog schema and executor defaults', () => {
  // The seed writes the schema as plain data, so nothing ties its defaults to
  // the executor's; this keeps the two from drifting apart.
  const properties = LLM_GENERATE_CONFIG_SCHEMA.properties;

  it('agree on max_items and max_tokens', () => {
    expect(properties.max_items.default).toBe(LlmLimits.DEFAULT_MAX_ITEMS);
    expect(properties.max_tokens.default).toBe(LlmLimits.DEFAULT_MAX_TOKENS);
  });

  it('offer exactly the providers the executor accepts', () => {
    const { executor } = setup();
    for (const provider of properties.provider.enum) {
      expect(executor.expectedConnectorKey({ provider })).toBe(provider);
    }
  });
});

describe('platform ceiling', () => {
  it("leaves room for a node's default max_items", () => {
    expect(LlmLimits.DEFAULT_MAX_ITEMS).toBeLessThanOrEqual(
      LlmLimits.DEFAULT_MAX_ITEMS_CEILING,
    );
  });
});

