import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetConnectorsQuery } from './get-connectors.query';
import { PrismaService } from '@app/database';
import type { Connector } from '@prisma/client';

@QueryHandler(GetConnectorsQuery)
export class GetConnectorsHandler implements IQueryHandler<GetConnectorsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetConnectorsQuery): Promise<Connector[]> {
    void query;
    return this.prisma.connector.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}
