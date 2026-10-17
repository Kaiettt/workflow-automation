import { z } from 'zod';
import { IPerItemExecutor } from '../../domain/entities/node-executor';
import {
  ConnectorKeys,
  LlmLimits,
  NodeKeys,
} from '../../domain/constants/execution.constants';
import { Item, ItemJson } from '../../domain/models/item';
import {
  LlmGenerateResult,
  LlmProviderError,
} from '../ports/llm-provider.port';
import { LlmProviderRegistry } from '../services/llm-provider.registry';

const PROVIDERS = [
  ConnectorKeys.ANTHROPIC,
  ConnectorKeys.OPENAI,
  ConnectorKeys.GEMINI,
] as const;

// An expression such as {{$json.text}} can resolve to a number, an object or null.
const asText = (value: unknown): unknown => {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
};

const blankToUndefined = (value: unknown): unknown =>
  value === '' || value === null ? undefined : value;

const ConfigSchema = z.object({
  provider: z.enum(PROVIDERS),
  credential_id: z.string().min(1),
  model: z.string().trim().min(1, 'LLM config.model is required'),
  // Blank or missing means "no system prompt", not an empty one.
  system_prompt: z.preprocess((value) => {
    const given = blankToUndefined(value);
    return given === undefined ? undefined : asText(given);
  }, z.string().optional()),
  prompt: z.preprocess(
    asText,
    z.string().min(1, 'LLM config.prompt must not be empty'),
  ),
  output_format: z.enum(['text', 'json']).default('text'),
  max_tokens: z.coerce
    .number()
    .int()
    .min(1)
    .default(LlmLimits.DEFAULT_MAX_TOKENS),
  temperature: z.preprocess(
    blankToUndefined,
    z.coerce.number().min(0).optional(),
  ),
  max_items: z.coerce
    .number()
    .int()
    .min(1)
    .default(LlmLimits.DEFAULT_MAX_ITEMS),
});

export type LlmGenerateConfig = z.infer<typeof ConfigSchema>;

const CredentialSchema = z.object({ api_key: z.string().min(1) });

export type Sleep = (ms: number) => Promise<void>;

const defaultSleep: Sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Reads LLM_MAX_ITEMS; anything that is not a positive integer falls back to the default ceiling.
export function parseMaxItemsCeiling(raw: string | undefined): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1
    ? value
    : LlmLimits.DEFAULT_MAX_ITEMS_CEILING;
}

// One prompt in, one answer out. Looping over items, filling the prompt with
// data and wiring the result onward are the engine's job.
export class LlmGenerateExecutor implements IPerItemExecutor<LlmGenerateConfig> {
  readonly key = NodeKeys.AI_LLM_GENERATE;
  readonly runMode = 'per_item' as const;

  constructor(
    private readonly registry: LlmProviderRegistry,
    private readonly maxItemsCeiling: number = LlmLimits.DEFAULT_MAX_ITEMS_CEILING,
    private readonly sleep: Sleep = defaultSleep,
  ) {}

  parseConfig(raw: unknown): LlmGenerateConfig {
    return ConfigSchema.parse(raw);
  }

  expectedConnectorKey(rawConfig: Record<string, unknown>): string | null {
    const provider = rawConfig.provider;
    return PROVIDERS.some((known) => known === provider)
      ? (provider as string)
      : null;
  }

  maxItems(rawConfig: Record<string, unknown>): {
    limit: number;
    reason: string;
  } {
    const asked = Number(rawConfig.max_items ?? LlmLimits.DEFAULT_MAX_ITEMS);
    const requested =
      Number.isInteger(asked) && asked >= 1
        ? asked
        : LlmLimits.DEFAULT_MAX_ITEMS;
    return requested <= this.maxItemsCeiling
      ? { limit: requested, reason: `the node's max_items (${requested})` }
      : {
          limit: this.maxItemsCeiling,
          reason: `the platform limit LLM_MAX_ITEMS (${this.maxItemsCeiling})`,
        };
  }

  async executeItem(params: {
    config: LlmGenerateConfig;
    item: Item;
    credential: unknown;
  }): Promise<ItemJson> {
    const { config } = params;
    const { api_key: apiKey } = CredentialSchema.parse(params.credential);
    const provider = this.registry.get(config.provider);

    const result = await this.generateWithRetry(() =>
      provider.generate({
        model: config.model,
        systemPrompt: config.system_prompt,
        prompt: config.prompt,
        maxTokens: config.max_tokens,
        temperature: config.temperature,
        outputFormat: config.output_format,
        apiKey,
      }),
    );

    const output: ItemJson = { text: result.text };
    if (config.output_format === 'json') {
      output.data = parseJsonOutput(result.text);
    }
    output.model = config.model;
    output.usage = result.usage
      ? {
          input_tokens: result.usage.inputTokens,
          output_tokens: result.usage.outputTokens,
        }
      : null;
    return output;
  }

  // Rate limits, timeouts and 5xx are retried with a growing pause; anything else fails at once.
  private async generateWithRetry(
    attempt: () => Promise<LlmGenerateResult>,
  ): Promise<LlmGenerateResult> {
    for (let retry = 0; ; retry += 1) {
      try {
        return await attempt();
      } catch (error) {
        const retryable = error instanceof LlmProviderError && error.retryable;
        if (!retryable || retry >= LlmLimits.MAX_RETRIES) throw error;
        await this.sleep(1000 * 2 ** retry);
      }
    }
  }
}

// Models sometimes wrap JSON in a code fence even when told not to.
export function parseJsonOutput(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  try {
    return JSON.parse(fenced ? fenced[1] : trimmed);
  } catch {
    throw new Error('LLM returned invalid JSON');
  }
}
