import {
  NodeTypeDefinition as PrismaNodeTypeDefinition,
  NodeCategory as PrismaNodeCategory,
} from '@prisma/client';
import { NodeTypeDefinition } from '../../../domain/entities/node-type-definition.entity';
import { NodeCategory } from '../../../domain/enums/node-category.enum';

export class NodeTypeDefinitionMapper {
  static toDomain(raw: PrismaNodeTypeDefinition): NodeTypeDefinition {
    return new NodeTypeDefinition(
      raw.id,
      raw.key,
      raw.displayName,
      this.mapCategoryToDomain(raw.category),
      raw.configSchema,
      raw.isActive,
      raw.icon,
      raw.color,
      raw.description,
      raw.inputSchema,
      raw.outputSchema,
      raw.connectorId,
      raw.createdAt,
      raw.updatedAt,
    );
  }

  private static mapCategoryToDomain(
    category: PrismaNodeCategory,
  ): NodeCategory {
    switch (category) {
      case PrismaNodeCategory.TRIGGER:
        return NodeCategory.TRIGGER;
      case PrismaNodeCategory.LOGIC:
        return NodeCategory.LOGIC;
      case PrismaNodeCategory.DATA_PROCESSING:
        return NodeCategory.DATA_PROCESSING;
      case PrismaNodeCategory.INTEGRATION:
        return NodeCategory.INTEGRATION;
      default:
        return NodeCategory.LOGIC;
    }
  }
}
