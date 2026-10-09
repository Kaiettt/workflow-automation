import {
  ConnectorCredential as PrismaConnectorCredential,
  ConnectorTestStatus as PrismaConnectorTestStatus,
} from '@prisma/client';
import { ConnectorCredential } from '../../../domain/entities/connector-credential.entity';
import { ConnectorTestStatus } from '../../../domain/enums/connector-test-status.enum';

import { Prisma } from '@prisma/client';

export class ConnectorCredentialMapper {
  static toDomain(raw: PrismaConnectorCredential): ConnectorCredential {
    return new ConnectorCredential(
      raw.id,
      raw.connectorId,
      raw.ownerId,
      raw.name,
      raw.encryptedSecret,
      raw.lastTestedAt,
      this.mapTestStatusToDomain(raw.lastTestStatus),
      raw.createdAt,
      raw.updatedAt,
    );
  }

  static toPersistence(
    entity: ConnectorCredential,
  ): Prisma.ConnectorCredentialUncheckedCreateInput {
    return {
      ...(entity.id ? { id: entity.id } : {}),
      connectorId: entity.connectorId,
      ownerId: entity.ownerId,
      name: entity.name,
      encryptedSecret: entity.encryptedSecret,
      lastTestedAt: entity.lastTestedAt || null,
      lastTestStatus: this.mapTestStatusToPersistence(
        entity.lastTestStatus || ConnectorTestStatus.UNTESTED,
      ),
    };
  }

  private static mapTestStatusToDomain(
    status: PrismaConnectorTestStatus,
  ): ConnectorTestStatus {
    switch (status) {
      case PrismaConnectorTestStatus.SUCCESS:
        return ConnectorTestStatus.SUCCESS;
      case PrismaConnectorTestStatus.FAILED:
        return ConnectorTestStatus.FAILED;
      default:
        return ConnectorTestStatus.UNTESTED;
    }
  }

  private static mapTestStatusToPersistence(
    status: ConnectorTestStatus,
  ): PrismaConnectorTestStatus {
    switch (status) {
      case ConnectorTestStatus.SUCCESS:
        return PrismaConnectorTestStatus.SUCCESS;
      case ConnectorTestStatus.FAILED:
        return PrismaConnectorTestStatus.FAILED;
      default:
        return PrismaConnectorTestStatus.UNTESTED;
    }
  }
}
