import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@app/database';
import {
  SUBSCRIPTION_PLAN_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
} from './domain/repositories';
import { SUBSCRIPTION_PROVISIONING_PORT } from './application/ports/subscription-provisioning.port';
import { SubscriptionProvisioningService } from './application/services/subscription-provisioning.service';
import { QUOTA_RESERVATION_PORT } from './application/ports/quota-reservation.port';
import { QuotaEnforcer } from './application/services/quota-enforcer';
import { PrismaSubscriptionRepository } from './infrastructure/persistence/prisma-subscription.repository';
import { PrismaSubscriptionPlanRepository } from './infrastructure/persistence/prisma-subscription-plan.repository';
import { SubscriptionLifecycleService } from './application/services/subscription-lifecycle.service';
import { GetCurrentSubscriptionHandler } from './application/queries/get-current-subscription.query';

@Module({
  imports: [PrismaModule, CqrsModule],
  providers: [
    {
      provide: SUBSCRIPTION_REPOSITORY,
      useClass: PrismaSubscriptionRepository,
    },
    {
      provide: SUBSCRIPTION_PLAN_REPOSITORY,
      useClass: PrismaSubscriptionPlanRepository,
    },
    {
      provide: SUBSCRIPTION_PROVISIONING_PORT,
      useClass: SubscriptionProvisioningService,
    },
    {
      provide: QUOTA_RESERVATION_PORT,
      useClass: QuotaEnforcer,
    },
    SubscriptionProvisioningService,
    QuotaEnforcer,
    SubscriptionLifecycleService,
    GetCurrentSubscriptionHandler,
  ],
  exports: [
    SUBSCRIPTION_REPOSITORY,
    SUBSCRIPTION_PLAN_REPOSITORY,
    SUBSCRIPTION_PROVISIONING_PORT,
    SubscriptionProvisioningService,
    QUOTA_RESERVATION_PORT,
    QuotaEnforcer,
    SubscriptionLifecycleService,
  ],
})
export class SubscriptionModule {}
