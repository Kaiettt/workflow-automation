import OpenAI from 'openai';
import { LlmLimits } from '../../domain/constants/execution.constants';
import {
  buildSystemPrompt,
  isRetryableStatus,
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmProvider,
  LlmProviderError,
} from '../../application/ports/llm-provider.port';

// The slice of the SDK client the adapter uses, so tests can stand in for it.
export interface OpenAiClientLike {
  chat: {
    completions: {
      create(
        body: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
      ): Promise<OpenAI.Chat.ChatCompletion>;
    };
  };
}

export type OpenAiClientFactory = (apiKey: string) => OpenAiClientLike;

// Retries are handled by the executor, so the SDK's own retries are turned off.
const defaultClientFactory: OpenAiClientFactory = (apiKey) =>
  new OpenAI({
    apiKey,
    timeout: LlmLimits.REQUEST_TIMEOUT_MS,
    maxRetries: 0,
  });

export class OpenAiLlmAdapter implements LlmProvider {
  readonly key = 'openai';

  constructor(
    private readonly clientFactory: OpenAiClientFactory = defaultClientFactory,
  ) {}

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResult> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const system = buildSystemPrompt(request);
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: request.prompt });

    const body: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: request.model,
      messages,
      max_completion_tokens: request.maxTokens,
    };
    // Some models reject any non-default temperature; the API's error is passed on.
    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }
    if (request.outputFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    let completion: OpenAI.Chat.ChatCompletion;
    try {
      completion = await this.clientFactory(
        request.apiKey,
      ).chat.completions.create(body);
    } catch (error) {
      throw toProviderError(error);
    }

    const choice = completion.choices[0];
    if (choice?.message.refusal) {
      throw new LlmProviderError(
        `The model declined this request: ${choice.message.refusal}`,
        false,
      );
    }
    const text = choice?.message.content ?? '';
    if (!text && choice?.finish_reason === 'length') {
      throw new LlmProviderError(
        `The response was cut off at max_tokens (${request.maxTokens}) before any text; increase max_tokens`,
        false,
      );
    }

    return {
      text,
      usage: completion.usage
        ? {
            inputTokens: completion.usage.prompt_tokens,
            outputTokens: completion.usage.completion_tokens,
          }
        : null,
    };
  }
}

function toProviderError(error: unknown): LlmProviderError {
  const message =
    error instanceof Error ? error.message : 'OpenAI request failed';
  if (error instanceof OpenAI.APIConnectionError) {
    return new LlmProviderError(message, true);
  }
  if (error instanceof OpenAI.APIError) {
    return new LlmProviderError(
      message,
      isRetryableStatus(error.status as number | undefined),
    );
  }
  return new LlmProviderError(message, false);
}
