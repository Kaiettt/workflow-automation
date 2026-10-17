import { NodeTypeDefinition } from '../entities/node-type-definition.entity';

export abstract class NodeTypeDefinitionRepository {
  abstract findAllActive(): Promise<NodeTypeDefinition[]>;
  abstract findByKeys(keys: string[]): Promise<NodeTypeDefinition[]>;
}
