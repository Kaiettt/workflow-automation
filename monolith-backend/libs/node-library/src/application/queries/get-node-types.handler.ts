import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetNodeTypesQuery } from './get-node-types.query';
import { PrismaService } from '@app/database';
import type { NodeTypeDefinition } from '@prisma/client';

@QueryHandler(GetNodeTypesQuery)
export class GetNodeTypesHandler implements IQueryHandler<GetNodeTypesQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetNodeTypesQuery): Promise<NodeTypeDefinition[]> {
    void query;
    return this.prisma.nodeTypeDefinition.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ category: 'asc' }, { displayName: 'asc' }],
    });
  }
}
