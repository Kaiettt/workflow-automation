import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@app/database';
import { AuthModule } from '@app/auth';
import { NodeTypesController } from './presentation/http/node-types.controller';
import { GetNodeTypesHandler } from './application/queries/get-node-types.handler';

const QueryHandlers = [GetNodeTypesHandler];

@Module({
  imports: [CqrsModule, PrismaModule, AuthModule],
  controllers: [NodeTypesController],
  providers: [...QueryHandlers],
  exports: [],
})
export class NodeLibraryModule {}
