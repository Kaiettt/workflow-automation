import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { ConnectorCredentialRepository } from '../../domain/repositories/connector-credential.repository';
import { ConnectorCredential } from '../../domain/entities/connector-credential.entity';
import { ConnectorCredentialMapper } from './mappers/connector-credential.mapper';

@Injectable()
export class PrismaConnectorCredentialRepository implements ConnectorCredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(credential: ConnectorCredential): Promise<void> {
    const data = ConnectorCredentialMapper.toPersistence(credential);
    await this.prisma.connectorCredential.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }

  async create(credential: ConnectorCredential): Promise<ConnectorCredential> {
    const data = ConnectorCredentialMapper.toPersistence(credential);
    const created = await this.prisma.connectorCredential.create({
      data: data,
    });
    return ConnectorCredentialMapper.toDomain(created);
  }
}
