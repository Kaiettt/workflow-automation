import { Inject, Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PlanCode, SubscriptionStatus } from '@prisma/client';
import { SUBSCRIPTION_REPOSITORY } from '../../domain/repositories';
import type { SubscriptionRepository } from '../../domain/repositories';

export class GetCurrentSubscriptionQuery {
  constructor(public readonly userId: string) {}
}

export interface CurrentSubscriptionDto {
  id: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextPlanId: string | null;
  autoRenew: boolean;
  plan: {
    id: string;
    code: PlanCode;
    name: string;
    priceVnd: number;
    monthlyQuota: number;
  };
  usage: {
    totalQuota: number;
    usedQuota: number;
    manualUsage: number;
    webhookUsage: number;
    scheduleUsage: number;
  } | null;
}

@Injectable()
@QueryHandler(GetCurrentSubscriptionQuery)
export class GetCurrentSubscriptionHandler implements IQueryHandler<
  GetCurrentSubscriptionQuery,
  CurrentSubscriptionDto | null
> {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  async execute(
    query: GetCurrentSubscriptionQuery,
  ): Promise<CurrentSubscriptionDto | null> {
    const subscription = await this.subscriptions.findByUserId(query.userId);
    if (!subscription?.plan) return null;
    const usage = await this.subscriptions.getCurrentUsage(subscription.id);
    return {
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      nextPlanId: subscription.nextPlanId ?? null,
      autoRenew: subscription.autoRenew,
      plan: {
        id: subscription.plan.id,
        code: subscription.plan.code,
        name: subscription.plan.name,
        priceVnd: subscription.plan.priceVnd,
        monthlyQuota: subscription.plan.monthlyQuota,
      },
      usage: usage
        ? {
            totalQuota: usage.totalQuota,
            usedQuota: usage.usedQuota,
            manualUsage: usage.manualUsage,
            webhookUsage: usage.webhookUsage,
            scheduleUsage: usage.scheduleUsage,
          }
        : null,
    };
  }
}
