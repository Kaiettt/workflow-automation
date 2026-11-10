import { Injectable } from '@nestjs/common';
import { IOnceExecutor } from '../../../domain/entities/node-executor';
import { MAIN_OUTPUT } from '../../../domain/entities/workflow-execution.entity';
import { isPlainObject, Item } from '../../../domain/models/item';
import { NodeConfigResolver } from '../node-config-resolver';
import { NodeRunParams } from '../node-runner';

@Injectable()
export class OnceExecutionStrategy {
  constructor(private readonly configResolver: NodeConfigResolver) {}

  async execute(
    executor: IOnceExecutor,
    rawConfig: Record<string, unknown>,
    params: NodeRunParams,
  ): Promise<Map<string, Item[]>> {
    const secret = await this.configResolver.resolveCredential(
      executor,
      rawConfig,
      params.credentialOwnerId,
    );
    const currentItem = params.items[0] ?? { json: {} };
    const config = this.configResolver.resolveItemConfig(
      executor,
      rawConfig,
      params.configSchema,
      {
        runs: params.runs,
        names: params.names,
        currentItem,
        currentIndex: 0,
        currentSources: params.inputSources,
      },
    );

    const output = await executor.execute({
      config,
      items: params.items,
      credential: secret,
    });

    if (
      !Array.isArray(output) ||
      !output.every((item) => isPlainObject(item) && isPlainObject(item.json))
    ) {
      throw new Error('Node returned an invalid list of items');
    }

    return new Map([[MAIN_OUTPUT, output]]);
  }
}
