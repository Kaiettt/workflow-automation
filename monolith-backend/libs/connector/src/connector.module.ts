import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@app/database';
import { AuthModule } from '@app/auth';
import { ConnectorsController } from './presentation/http/connectors.controller';
import { GetConnectorsHandler } from './application/queries/get-connectors.handler';

const QueryHandlers = [GetConnectorsHandler];

@Module({
  imports: [CqrsModule, PrismaModule, AuthModule],
  controllers: [ConnectorsController],
  providers: [...QueryHandlers],
  exports: [],
})
export class ConnectorModule {}
