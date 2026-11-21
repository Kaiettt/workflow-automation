import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NodeTypeDefinitionRepository } from '../../domain/repositories/node-type-definition.repository';
import { NodeTypeDefinition } from '../../domain/entities/node-type-definition.entity';
export class GetNodeMetadataQuery {
  constructor(readonly keys: string[]) {}
}
@QueryHandler(GetNodeMetadataQuery)
export class GetNodeMetadataHandler implements IQueryHandler<GetNodeMetadataQuery> {
  constructor(private readonly repository: NodeTypeDefinitionRepository) {}
  execute(query: GetNodeMetadataQuery): Promise<NodeTypeDefinition[]> {
    return this.repository.findByKeys(query.keys);
  }
}
