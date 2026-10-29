import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@app/database';
import { AuthModule } from '@app/auth';
import { ConnectorsController } from './presentation/http/connectors.controller';
import { GetConnectorsHandler } from './application/queries/get-connectors.query';
import { ListCredentialsHandler } from './application/queries/list-credentials.query';
import { CreateApiKeyCredentialHandler } from './application/commands/create-api-key-credential.command';
import { ConnectorRepository } from './domain/repositories/connector.repository';
import { PrismaConnectorRepository } from './infrastructure/persistence/prisma-connector.repository';
import { ConnectorCredentialRepository } from './domain/repositories/connector-credential.repository';
import { PrismaConnectorCredentialRepository } from './infrastructure/persistence/prisma-connector-credential.repository';
import { CredentialVault } from './application/credential-vault';

const QueryHandlers = [GetConnectorsHandler, ListCredentialsHandler];

const CommandHandlers = [CreateApiKeyCredentialHandler];

const Repositories = [
  {
    provide: ConnectorRepository,
    useClass: PrismaConnectorRepository,
  },
  {
    provide: ConnectorCredentialRepository,
    useClass: PrismaConnectorCredentialRepository,
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
  exports: [...Repositories, CredentialVault],
})
export class ConnectorModule {}
