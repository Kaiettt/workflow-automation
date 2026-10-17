import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  GetNodeConfigSchemasQuery,
  NodeConfigSchemaDto,
} from '@app/node-library';
import { NodeCatalogPort } from '../../application/ports/node-catalog.port';

@Injectable()
export class NodeCatalogAdapter implements NodeCatalogPort {
  constructor(private readonly queryBus: QueryBus) {}

  async getConfigSchemas(keys: string[]): Promise<Map<string, unknown>> {
    const rows: NodeConfigSchemaDto[] = await this.queryBus.execute(
      new GetNodeConfigSchemasQuery(keys),
    );
    return new Map(rows.map((row) => [row.key, row.configSchema]));
  }
}
