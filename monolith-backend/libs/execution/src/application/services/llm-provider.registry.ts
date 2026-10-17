import { LlmProvider } from '../ports/llm-provider.port';

export class LlmProviderRegistry {
  private readonly providers: ReadonlyMap<string, LlmProvider>;

  constructor(providers: LlmProvider[]) {
    this.providers = new Map(providers.map((p) => [p.key, p]));
  }

  get(key: string): LlmProvider {
    const provider = this.providers.get(key);
    if (!provider) throw new Error(`No LLM provider registered for "${key}"`);
    return provider;
  }
}
