import { Module } from '@nestjs/common';
import { NodeLibraryModule } from '@app/node-library';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '@app/auth';
import { PrismaModule } from '@app/database';
import { ConnectorModule } from '@app/connector';
import { AdminReadPort } from './application/admin-read.port';
import { AdminReadHandler } from './application/admin-read.query';
import { PrismaAdminRead } from './infrastructure/prisma-admin-read';
import { AdminController } from './presentation/admin.controller';
import { AdminMutationFieldsGuard } from './presentation/admin-mutation-fields.guard';
import {
  UpdateSubscriptionPlanHandler,
  SubscriptionPlanAdminPort,
} from './application/update-subscription-plan.command';
import { PrismaSubscriptionPlanAdminRepository } from './infrastructure/prisma-subscription-plan-admin.repository';

@Module({
  imports: [
    CqrsModule,
    AuthModule,
    PrismaModule,
    ConnectorModule,
    NodeLibraryModule,
  ],
  controllers: [AdminController],
  providers: [
    AdminMutationFieldsGuard,
    AdminReadHandler,
    UpdateSubscriptionPlanHandler,
    { provide: AdminReadPort, useClass: PrismaAdminRead },
    {
      provide: SubscriptionPlanAdminPort,
      useClass: PrismaSubscriptionPlanAdminRepository,
    },
  ],
})
export class AdminModule {}
