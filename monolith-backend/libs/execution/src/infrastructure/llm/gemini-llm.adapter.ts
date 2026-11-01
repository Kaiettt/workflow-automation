import {
  ApiError,
  FinishReason,
  GenerateContentResponse,
  GoogleGenAI,
} from '@google/genai';
import type { GenerateContentParameters } from '@google/genai';
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
export interface GeminiClientLike {
  models: {
    generateContent(
      params: GenerateContentParameters,
    ): Promise<GenerateContentResponse>;
  };
}

export type GeminiClientFactory = (apiKey: string) => GeminiClientLike;

const defaultClientFactory: GeminiClientFactory = (apiKey) =>
  new GoogleGenAI({ apiKey });

export class GeminiLlmAdapter implements LlmProvider {
  readonly key = 'gemini';

  constructor(
    private readonly clientFactory: GeminiClientFactory = defaultClientFactory,
  ) {}

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResult> {
    const history = conversationHistory(request);
    const params: GenerateContentParameters = {
      model: request.model,
      // Gemini calls the assistant "model".
      contents:
        history.length === 0
          ? request.prompt
          : [
              ...history.map((message) => ({
                role: message.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: message.content }],
              })),
              { role: 'user', parts: [{ text: request.prompt }] },
            ],
      config: {
        systemInstruction: buildSystemPrompt(request),
        maxOutputTokens: request.maxTokens,
        abortSignal: AbortSignal.timeout(LlmLimits.REQUEST_TIMEOUT_MS),
        ...(request.temperature !== undefined && {
          temperature: request.temperature,
        }),
        ...(request.outputFormat === 'json' && {
          responseMimeType: 'application/json',
        }),
      },
    };

    let response: GenerateContentResponse;
    try {
      response = await this.clientFactory(
        request.apiKey,
      ).models.generateContent(params);
    } catch (error) {
      throw toProviderError(error);
    }

    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) {
      throw new LlmProviderError(
        `The model declined this request (${blockReason})`,
        false,
      );
    }
    const text = response.text ?? '';
    if (
      !text &&
      response.candidates?.[0]?.finishReason === FinishReason.MAX_TOKENS
    ) {
      throw new LlmProviderError(
        `The response was cut off at max_tokens (${request.maxTokens}) before any text; increase max_tokens`,
        false,
      );
    }

    const usage = response.usageMetadata;
    return {
      text,
      usage: usage
        ? {
            inputTokens: usage.promptTokenCount ?? 0,
            outputTokens: usage.candidatesTokenCount ?? 0,
          }
        : null,
    };
  }
}

function toProviderError(error: unknown): LlmProviderError {
  const message =
    error instanceof Error ? error.message : 'Gemini request failed';
  if (error instanceof ApiError) {
    return new LlmProviderError(message, isRetryableStatus(error.status));
  }
  // A timeout (AbortSignal.timeout) or a dropped connection: nothing says it cannot work next time.
  if (
    error instanceof Error &&
    ['TimeoutError', 'AbortError', 'TypeError'].includes(error.name)
  ) {
    return new LlmProviderError(message, true);
  }
  return new LlmProviderError(message, false);
}
