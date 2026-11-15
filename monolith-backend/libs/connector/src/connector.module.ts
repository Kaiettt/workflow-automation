import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@app/database';
import { AuthModule } from '@app/auth';
import { ConnectorsController } from './presentation/http/connectors.controller';
import { GetConnectorsHandler } from './application/queries/get-connectors.query';
import { ListCredentialsHandler } from './application/queries/list-credentials.query';
import { CreateApiKeyCredentialHandler } from './application/commands/create-api-key-credential.command';
import { ChangeConnectorPolicyHandler } from './application/commands/change-connector-policy.command';
import { ConnectorPolicyPort } from './application/ports/connector-policy.port';
import { PrismaConnectorPolicyRepository } from './infrastructure/persistence/prisma-connector-policy.repository';
import { ConnectorRepository } from './domain/repositories/connector.repository';
import { PrismaConnectorRepository } from './infrastructure/persistence/prisma-connector.repository';
import { ConnectorCredentialRepository } from './domain/repositories/connector-credential.repository';
import { PrismaConnectorCredentialRepository } from './infrastructure/persistence/prisma-connector-credential.repository';
import { CredentialVault } from './application/credential-vault';

const QueryHandlers = [GetConnectorsHandler, ListCredentialsHandler];

const CommandHandlers = [
  CreateApiKeyCredentialHandler,
  ChangeConnectorPolicyHandler,
];

const Repositories = [
  {
    provide: ConnectorRepository,
    useClass: PrismaConnectorRepository,
  },
  {
    provide: ConnectorCredentialRepository,
    useClass: PrismaConnectorCredentialRepository,
  },
  {
    provide: ConnectorPolicyPort,
    useClass: PrismaConnectorPolicyRepository,
  },
];

@Module({
  imports: [CqrsModule, PrismaModule, AuthModule],
  controllers: [ConnectorsController],
  providers: [
    ...QueryHandlers,
    ...CommandHandlers,
    ...Repositories,
    CredentialVault,
  ],
  exports: [...Repositories, CredentialVault, ConnectorPolicyPort],
})
export class ConnectorModule {}
