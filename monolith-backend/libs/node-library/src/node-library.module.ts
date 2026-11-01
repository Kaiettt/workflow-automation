import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@app/database';
import { AuthModule } from '@app/auth';
import { NodeTypesController } from './presentation/http/node-types.controller';
import { GetNodeTypesHandler } from './application/queries/get-node-types.query';
import { GetNodeConfigSchemasHandler } from './application/queries/get-node-config-schemas.query';
import { NodeTypeDefinitionRepository } from './domain/repositories/node-type-definition.repository';
import { PrismaNodeTypeDefinitionRepository } from './infrastructure/persistence/prisma-node-type-definition.repository';
import { AppsModule } from '@app/apps';
import { PackageCatalogSync } from './infrastructure/package-catalog.sync';

const QueryHandlers = [GetNodeTypesHandler, GetNodeConfigSchemasHandler];

const Repositories = [
  {
    provide: NodeTypeDefinitionRepository,
    useClass: PrismaNodeTypeDefinitionRepository,
  },
];

@Module({
  imports: [CqrsModule, PrismaModule, AuthModule, AppsModule],
  controllers: [NodeTypesController],
  providers: [...QueryHandlers, ...Repositories, PackageCatalogSync],
  exports: [...Repositories],
})
export class NodeLibraryModule {}
