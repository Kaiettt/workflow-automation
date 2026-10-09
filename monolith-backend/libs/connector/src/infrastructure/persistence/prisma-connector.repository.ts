import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { ConnectorRepository } from '../../domain/repositories/connector.repository';
import { Connector } from '../../domain/entities/connector.entity';
import { ConnectorMapper } from './mappers/connector.mapper';

@Injectable()
export class PrismaConnectorRepository implements ConnectorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllActive(): Promise<Connector[]> {
    const connectors = await this.prisma.connector.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return connectors.map((row) => ConnectorMapper.toDomain(row));
  }

  async findByKey(key: string): Promise<Connector | null> {
    const connector = await this.prisma.connector.findUnique({
      where: { key },
    });
    if (!connector) {
      return null;
    }
    return ConnectorMapper.toDomain(connector);
  }
}
