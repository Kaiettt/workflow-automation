import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NodeCategory } from '../../../domain/enums/node-category.enum';
import { NodeTypeDefinition } from '../../../domain/entities/node-type-definition.entity';

export class NodeTypeDefinitionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  displayName: string;

  @ApiPropertyOptional()
  icon?: string | null;

  @ApiPropertyOptional()
  color?: string | null;

  @ApiProperty({ enum: NodeCategory })
  category: NodeCategory;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  configSchema: unknown;

  @ApiPropertyOptional()
  inputSchema?: unknown;

  @ApiPropertyOptional()
  outputSchema?: unknown;

  @ApiPropertyOptional()
  connectorId?: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromDomain(entity: NodeTypeDefinition): NodeTypeDefinitionResponseDto {
    const dto = new NodeTypeDefinitionResponseDto();
    dto.id = entity.id;
    dto.key = entity.key;
    dto.displayName = entity.displayName;
    dto.icon = entity.icon;
    dto.color = entity.color;
    dto.category = entity.category;
    dto.description = entity.description;
    dto.configSchema = entity.configSchema;
    dto.inputSchema = entity.inputSchema;
    dto.outputSchema = entity.outputSchema;
    dto.connectorId = entity.connectorId;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt as Date;
    dto.updatedAt = entity.updatedAt as Date;
    return dto;
  }
}
