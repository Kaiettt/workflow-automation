import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NodeTypeDefinitionRepository } from '../../domain/repositories/node-type-definition.repository';
import { NodeTypeDefinition } from '../../domain/entities/node-type-definition.entity';

export class GetNodeTypesQuery {
  constructor() {}
}

@QueryHandler(GetNodeTypesQuery)
export class GetNodeTypesHandler implements IQueryHandler<GetNodeTypesQuery> {
  constructor(private readonly nodeTypeRepo: NodeTypeDefinitionRepository) {}

  async execute(query: GetNodeTypesQuery): Promise<NodeTypeDefinition[]> {
    void query;
    return this.nodeTypeRepo.findAllActive();
  }
}
