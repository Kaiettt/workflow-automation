import Anthropic from '@anthropic-ai/sdk';
import { LlmLimits } from '../../domain/constants/execution.constants';
import {
  buildSystemPrompt,
  conversationHistory,
  isRetryableStatus,
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmProvider,
  LlmProviderError,
} from '../../application/ports/llm-provider.port';

// The slice of the SDK client the adapter uses, so tests can stand in for it.
export interface AnthropicClientLike {
  messages: {
    stream(body: Anthropic.MessageCreateParamsNonStreaming): {
      finalMessage(): Promise<Anthropic.Message>;
    };
  };
}

export type AnthropicClientFactory = (apiKey: string) => AnthropicClientLike;

// Retries are handled by the executor, so the SDK's own retries are turned off.
const defaultClientFactory: AnthropicClientFactory = (apiKey) =>
  new Anthropic({
    apiKey,
    timeout: LlmLimits.REQUEST_TIMEOUT_MS,
    maxRetries: 0,
  });

export class AnthropicLlmAdapter implements LlmProvider {
  readonly key = 'anthropic';

  constructor(
    private readonly clientFactory: AnthropicClientFactory = defaultClientFactory,
  ) {}

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResult> {
    const body: Anthropic.MessageCreateParamsNonStreaming = {
      model: request.model,
      max_tokens: request.maxTokens,
      messages: [
        ...conversationHistory(request),
        { role: 'user', content: request.prompt },
      ],
    };
    const system = buildSystemPrompt(request);
    if (system) body.system = system;
    // Some current models reject any non-default temperature; the API's error is passed on.
    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    let message: Anthropic.Message;
    try {
      // Streaming keeps long generations clear of HTTP timeouts.
      message = await this.clientFactory(request.apiKey)
        .messages.stream(body)
        .finalMessage();
    } catch (error) {
      throw toProviderError(error);
    }

    if (message.stop_reason === 'refusal') {
      const category = message.stop_details?.category;
      throw new LlmProviderError(
        `The model declined this request${category ? ` (${category})` : ''}`,
        false,
      );
    }

    const text = message.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('');
    if (!text && message.stop_reason === 'max_tokens') {
      throw new LlmProviderError(
        `The response was cut off at max_tokens (${request.maxTokens}) before any text; increase max_tokens`,
        false,
      );
    }

    return {
      text,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  }
}

function toProviderError(error: unknown): LlmProviderError {
  const message =
    error instanceof Error ? error.message : 'Anthropic request failed';
  if (error instanceof Anthropic.APIConnectionError) {
    return new LlmProviderError(message, true);
  }
  if (error instanceof Anthropic.APIError) {
    return new LlmProviderError(
      message,
      isRetryableStatus(error.status as number | undefined),
    );
  }
  return new LlmProviderError(message, false);
}
