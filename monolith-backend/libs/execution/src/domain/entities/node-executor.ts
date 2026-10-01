export interface INodeExecutor<
  TConfig = unknown,
  TInput = unknown,
  TOutput = unknown,
> {
  readonly key: string;
  parseConfig?(raw: unknown): TConfig;
  parseInput?(raw: unknown): TInput | null;
  execute(params: {
    config: TConfig;
    input: TInput | null;
    credential: unknown;
  }): Promise<TOutput | null>;
}
