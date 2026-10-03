import { z } from 'zod';

export interface INodeExecutor<
  TConfig = unknown,
  TInput = unknown,
  TOutput = unknown,
> {
  readonly key: string;
  readonly configSchema?: z.ZodSchema<TConfig>;
  readonly inputSchema?: z.ZodSchema<TInput>;
  readonly credentialSchema?: z.ZodSchema<unknown>;

  parseConfig?(raw: unknown): TConfig;
  parseInput?(raw: unknown): TInput | null;
  parseCredential?(raw: unknown): unknown;

  execute(params: {
    config: TConfig;
    input: TInput | null;
    credential: unknown;
  }): Promise<TOutput | null>;
}
