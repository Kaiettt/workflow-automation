import {
  Connector as PrismaConnector,
  ConnectorAuthType as PrismaConnectorAuthType,
} from '@prisma/client';
import { Connector } from '../../../domain/entities/connector.entity';
import { ConnectorAuthType } from '../../../domain/enums/connector-auth-type.enum';

export class ConnectorMapper {
  static toDomain(raw: PrismaConnector): Connector {
    return new Connector(
      raw.id,
      raw.key,
      raw.name,
      this.mapAuthTypeToDomain(raw.authType),
      raw.configSchema,
      raw.isActive,
      raw.createdAt,
    );
  }

  private static mapAuthTypeToDomain(
    type: PrismaConnectorAuthType,
  ): ConnectorAuthType {
    switch (type) {
      case PrismaConnectorAuthType.NONE:
        return ConnectorAuthType.NONE;
      case PrismaConnectorAuthType.API_KEY:
        return ConnectorAuthType.API_KEY;
      case PrismaConnectorAuthType.OAUTH2:
        return ConnectorAuthType.OAUTH2;
      default:
        return ConnectorAuthType.NONE;
    }
  }
}
