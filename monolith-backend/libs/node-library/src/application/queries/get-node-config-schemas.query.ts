import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NodeTypeDefinitionRepository } from '../../domain/repositories/node-type-definition.repository';

export interface NodeConfigSchemaDto {
  key: string;
  configSchema: unknown;
}

export class GetNodeConfigSchemasQuery {
  constructor(readonly keys: string[]) {}
}

@QueryHandler(GetNodeConfigSchemasQuery)
export class GetNodeConfigSchemasHandler implements IQueryHandler<GetNodeConfigSchemasQuery> {
  constructor(private readonly nodeTypeRepo: NodeTypeDefinitionRepository) {}

  async execute(
    query: GetNodeConfigSchemasQuery,
  ): Promise<NodeConfigSchemaDto[]> {
    const nodeTypes = await this.nodeTypeRepo.findByKeys(query.keys);
    return nodeTypes.map((nodeType) => ({
      key: nodeType.key,
      configSchema: nodeType.configSchema,
    }));
  }
}
