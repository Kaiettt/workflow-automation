import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ApiError, FinishReason } from '@google/genai';
import type { GenerateContentResponse } from '@google/genai';
import {
  LlmGenerateRequest,
  LlmProviderError,
} from '@app/execution/application/ports/llm-provider.port';
import { AnthropicLlmAdapter } from '@app/execution/infrastructure/llm/anthropic-llm.adapter';
import { OpenAiLlmAdapter } from '@app/execution/infrastructure/llm/openai-llm.adapter';
import { GeminiLlmAdapter } from '@app/execution/infrastructure/llm/gemini-llm.adapter';

const request: LlmGenerateRequest = {
  model: 'm',
  systemPrompt: 'Be brief',
  prompt: 'Hello',
  maxTokens: 200,
  outputFormat: 'text',
  apiKey: 'key-1',
};

const rejection = async (
  promise: Promise<unknown>,
): Promise<LlmProviderError> => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(LlmProviderError);
    return error as LlmProviderError;
  }
  throw new Error('expected the call to fail');
};

describe('AnthropicLlmAdapter', () => {
  const message = (overrides: Record<string, unknown> = {}) =>
    ({
      content: [
        { type: 'text', text: 'Hi ' },
        { type: 'text', text: 'there' },
      ],
      stop_reason: 'end_turn',
      usage: { input_tokens: 9, output_tokens: 4 },
      ...overrides,
    }) as unknown as Anthropic.Message;

  const adapterReturning = (result: Anthropic.Message | Error) => {
    const stream = jest.fn().mockReturnValue({
      finalMessage: () =>
        result instanceof Error
          ? Promise.reject(result)
          : Promise.resolve(result),
    });
    const factory = jest.fn().mockReturnValue({ messages: { stream } });
    return { adapter: new AnthropicLlmAdapter(factory), stream, factory };
  };

  it('sends the prompt and returns the joined text with usage', async () => {
    const { adapter, stream, factory } = adapterReturning(message());
    const result = await adapter.generate({ ...request, temperature: 0.3 });

    expect(factory).toHaveBeenCalledWith('key-1');
    expect(stream).toHaveBeenCalledWith({
      model: 'm',
      max_tokens: 200,
      system: 'Be brief',
      temperature: 0.3,
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(result).toEqual({
      text: 'Hi there',
      usage: { inputTokens: 9, outputTokens: 4 },
    });
  });

  it('omits system and temperature when not given, and asks for JSON in the system prompt', async () => {
    const { adapter, stream } = adapterReturning(message());
    await adapter.generate({ ...request, systemPrompt: undefined });
    await adapter.generate({
      ...request,
      systemPrompt: 'Be brief',
      outputFormat: 'json',
    });

    const [plain, json] = stream.mock.calls as Array<[Record<string, unknown>]>;
    expect(plain[0]).not.toHaveProperty('system');
    expect(plain[0]).not.toHaveProperty('temperature');
    expect(json[0].system).toMatch(/^Be brief\n\nRespond with valid JSON only/);
  });

  it('skips non-text blocks such as thinking', async () => {
    const { adapter } = adapterReturning(
      message({
        content: [
          { type: 'thinking', thinking: '...' },
          { type: 'text', text: 'answer' },
        ],
      }),
    );
    expect((await adapter.generate(request)).text).toBe('answer');
  });

  it('fails clearly when max_tokens was spent before any text', async () => {
    const { adapter } = adapterReturning(
      message({ content: [], stop_reason: 'max_tokens' }),
    );
    const error = await rejection(adapter.generate(request));
    expect(error.retryable).toBe(false);
    expect(error.message).toContain('increase max_tokens');
  });

  it('keeps partial text when the answer was cut off after some output', async () => {
    const { adapter } = adapterReturning(
      message({ stop_reason: 'max_tokens' }),
    );
    expect((await adapter.generate(request)).text).toBe('Hi there');
  });

  it('reports a refusal with its category', async () => {
    const { adapter } = adapterReturning(
      message({
        content: [],
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'cyber' },
      }),
    );
    const error = await rejection(adapter.generate(request));
    expect(error.retryable).toBe(false);
    expect(error.message).toContain('(cyber)');
  });

  it.each([
    [429, true],
    [500, true],
    [503, true],
    [408, true],
    [400, false],
    [401, false],
    [404, false],
  ])('classifies HTTP %i as retryable=%s', async (status, retryable) => {
    // The SDK builds the message from the response body.
    const apiError = Anthropic.APIError.generate(
      status,
      { message: 'api said no' },
      undefined,
      new Headers(),
    );
    const { adapter } = adapterReturning(apiError);
    const error = await rejection(adapter.generate(request));
    expect(error.retryable).toBe(retryable);
    expect(error.message).toContain('api said no');
  });

  it('treats a timeout and a dropped connection as retryable', async () => {
    for (const failure of [
      new Anthropic.APIConnectionTimeoutError(),
      new Anthropic.APIConnectionError({ message: 'socket hang up' }),
    ]) {
      const { adapter } = adapterReturning(failure);
      expect((await rejection(adapter.generate(request))).retryable).toBe(true);
    }
  });

  it('does not retry an unknown failure', async () => {
    const { adapter } = adapterReturning(new Error('weird'));
    expect((await rejection(adapter.generate(request))).retryable).toBe(false);
  });
});

describe('OpenAiLlmAdapter', () => {
  const completion = (overrides: Record<string, unknown> = {}) =>
    ({
      choices: [
        {
          message: { content: 'Hi there', refusal: null },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 7, completion_tokens: 3 },
      ...overrides,
    }) as unknown as OpenAI.Chat.ChatCompletion;

  const adapterReturning = (result: OpenAI.Chat.ChatCompletion | Error) => {
    const create = jest
      .fn()
      .mockImplementation(() =>
        result instanceof Error
          ? Promise.reject(result)
          : Promise.resolve(result),
      );
    const factory = jest
      .fn()
      .mockReturnValue({ chat: { completions: { create } } });
    return { adapter: new OpenAiLlmAdapter(factory), create, factory };
  };

  it('sends system + user messages and returns text with usage', async () => {
    const { adapter, create, factory } = adapterReturning(completion());
    const result = await adapter.generate({ ...request, temperature: 1 });

    expect(factory).toHaveBeenCalledWith('key-1');
    expect(create).toHaveBeenCalledWith({
      model: 'm',
      messages: [
        { role: 'system', content: 'Be brief' },
        { role: 'user', content: 'Hello' },
      ],
      max_completion_tokens: 200,
      temperature: 1,
    });
    expect(result).toEqual({
      text: 'Hi there',
      usage: { inputTokens: 7, outputTokens: 3 },
    });
  });

  it('uses JSON mode and mentions JSON in the system message', async () => {
    const { adapter, create } = adapterReturning(completion());
    await adapter.generate({
      ...request,
      systemPrompt: undefined,
      outputFormat: 'json',
    });

    const [body] = create.mock.calls[0] as [Record<string, unknown>];
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages).toEqual([
      {
        role: 'system',
        content: expect.stringContaining('valid JSON only') as string,
      },
      { role: 'user', content: 'Hello' },
    ]);
  });

  it('has no system message when none is given', async () => {
    const { adapter, create } = adapterReturning(completion());
    await adapter.generate({ ...request, systemPrompt: undefined });
    const [body] = create.mock.calls[0] as [{ messages: unknown[] }];
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  it('reports a refusal', async () => {
    const { adapter } = adapterReturning(
      completion({
        choices: [
          {
            message: { content: null, refusal: 'cannot help' },
            finish_reason: 'stop',
          },
        ],
      }),
    );
    const error = await rejection(adapter.generate(request));
    expect(error.retryable).toBe(false);
    expect(error.message).toContain('cannot help');
  });

  it('fails clearly when the limit was reached before any text', async () => {
    const { adapter } = adapterReturning(
      completion({
        choices: [{ message: { content: '' }, finish_reason: 'length' }],
      }),
    );
    expect((await rejection(adapter.generate(request))).message).toContain(
      'increase max_tokens',
    );
  });

  it('copes with a response without usage', async () => {
    const { adapter } = adapterReturning(completion({ usage: undefined }));
    expect((await adapter.generate(request)).usage).toBeNull();
  });

  it.each([
    [429, true],
    [502, true],
    [400, false],
    [401, false],
  ])('classifies HTTP %i as retryable=%s', async (status, retryable) => {
    const apiError = OpenAI.APIError.generate(
      status,
      { message: 'nope' },
      'nope',
      new Headers(),
    );
    const { adapter } = adapterReturning(apiError);
    expect((await rejection(adapter.generate(request))).retryable).toBe(
      retryable,
    );
  });

  it('treats a timeout as retryable', async () => {
    const { adapter } = adapterReturning(
      new OpenAI.APIConnectionTimeoutError(),
    );
    expect((await rejection(adapter.generate(request))).retryable).toBe(true);
  });
});

describe('GeminiLlmAdapter', () => {
  const response = (overrides: Record<string, unknown> = {}) =>
    ({
      text: 'Hi there',
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 },
      candidates: [{ finishReason: FinishReason.STOP }],
      ...overrides,
    }) as unknown as GenerateContentResponse;

  const adapterReturning = (result: GenerateContentResponse | Error) => {
    const generateContent = jest
      .fn()
      .mockImplementation(() =>
        result instanceof Error
          ? Promise.reject(result)
          : Promise.resolve(result),
      );
    const factory = jest.fn().mockReturnValue({ models: { generateContent } });
    return { adapter: new GeminiLlmAdapter(factory), generateContent, factory };
  };

  it('sends the prompt with its config and returns text with usage', async () => {
    const { adapter, generateContent, factory } = adapterReturning(response());
    const result = await adapter.generate({ ...request, temperature: 0.4 });

    expect(factory).toHaveBeenCalledWith('key-1');
    const [params] = generateContent.mock.calls[0] as [
      { model: string; contents: string; config: Record<string, unknown> },
    ];
    expect(params.model).toBe('m');
    expect(params.contents).toBe('Hello');
    expect(params.config).toMatchObject({
      systemInstruction: 'Be brief',
      maxOutputTokens: 200,
      temperature: 0.4,
    });
    expect(params.config.abortSignal).toBeInstanceOf(AbortSignal);
    expect(params.config).not.toHaveProperty('responseMimeType');
    expect(result).toEqual({
      text: 'Hi there',
      usage: { inputTokens: 5, outputTokens: 2 },
    });
  });

  it('asks for JSON output', async () => {
    const { adapter, generateContent } = adapterReturning(response());
    await adapter.generate({ ...request, outputFormat: 'json' });
    const [params] = generateContent.mock.calls[0] as [
      { config: Record<string, unknown> },
    ];
    expect(params.config.responseMimeType).toBe('application/json');
  });

  it('reports a blocked prompt', async () => {
    const { adapter } = adapterReturning(
      response({ text: undefined, promptFeedback: { blockReason: 'SAFETY' } }),
    );
    const error = await rejection(adapter.generate(request));
    expect(error.retryable).toBe(false);
    expect(error.message).toContain('SAFETY');
  });

  it('fails clearly when max tokens ran out before any text', async () => {
    const { adapter } = adapterReturning(
      response({
        text: undefined,
        candidates: [{ finishReason: FinishReason.MAX_TOKENS }],
      }),
    );
    expect((await rejection(adapter.generate(request))).message).toContain(
      'increase max_tokens',
    );
  });

  it('copes with a response without usage', async () => {
    const { adapter } = adapterReturning(
      response({ usageMetadata: undefined }),
    );
    expect((await adapter.generate(request)).usage).toBeNull();
  });

  it.each([
    [429, true],
    [503, true],
    [400, false],
    [403, false],
  ])('classifies HTTP %i as retryable=%s', async (status, retryable) => {
    const { adapter } = adapterReturning(
      new ApiError({ message: 'nope', status }),
    );
    expect((await rejection(adapter.generate(request))).retryable).toBe(
      retryable,
    );
  });

  it('treats a timeout as retryable', async () => {
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';
    const { adapter } = adapterReturning(timeout);
    expect((await rejection(adapter.generate(request))).retryable).toBe(true);
  });

  it('does not retry an unknown failure', async () => {
    const { adapter } = adapterReturning(new Error('weird'));
    expect((await rejection(adapter.generate(request))).retryable).toBe(false);
  });
});

