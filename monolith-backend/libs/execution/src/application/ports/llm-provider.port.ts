export interface LlmGenerateRequest {
  model: string;
  systemPrompt?: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
  outputFormat: 'text' | 'json';
  apiKey: string;
}

export interface LlmGenerateResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number } | null;
}

// One adapter per LLM vendor. Adapters make a single attempt; retrying is the executor's job.
export interface LlmProvider {
  readonly key: string;
  generate(request: LlmGenerateRequest): Promise<LlmGenerateResult>;
}

export class LlmProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'LlmProviderError';
  }
}

export const JSON_ONLY_INSTRUCTION =
  'Respond with valid JSON only: no code fences and no text outside the JSON.';

// Text of the system prompt, with the JSON instruction appended when JSON output is requested.
export function buildSystemPrompt(
  request: LlmGenerateRequest,
): string | undefined {
  if (request.outputFormat !== 'json') return request.systemPrompt;
  return request.systemPrompt
    ? `${request.systemPrompt}\n\n${JSON_ONLY_INSTRUCTION}`
    : JSON_ONLY_INSTRUCTION;
}

export function isRetryableStatus(status: number | undefined): boolean {
  return (
    status === 408 || status === 429 || (status !== undefined && status >= 500)
  );
}
