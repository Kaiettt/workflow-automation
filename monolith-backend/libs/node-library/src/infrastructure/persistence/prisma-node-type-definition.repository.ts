import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { NodeTypeDefinitionRepository } from '../../domain/repositories/node-type-definition.repository';
import { NodeTypeDefinition } from '../../domain/entities/node-type-definition.entity';
import { NodeTypeDefinitionMapper } from './mappers/node-type-definition.mapper';

@Injectable()
export class PrismaNodeTypeDefinitionRepository implements NodeTypeDefinitionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllActive(): Promise<NodeTypeDefinition[]> {
    const nodeTypes = await this.prisma.nodeTypeDefinition.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ category: 'asc' }, { displayName: 'asc' }],
    });

    return nodeTypes.map((row) => NodeTypeDefinitionMapper.toDomain(row));
  }
}
