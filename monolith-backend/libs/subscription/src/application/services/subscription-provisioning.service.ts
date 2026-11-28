import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PlanCode, SubscriptionStatus } from '@prisma/client';
import { SubscriptionModel } from '../../domain/entities';
import {
  SUBSCRIPTION_PLAN_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
} from '../../domain/repositories';
import type {
  SubscriptionPlanRepository,
  SubscriptionRepository,
} from '../../domain/repositories';
import { SubscriptionProvisioningPort } from '../ports/subscription-provisioning.port';

@Injectable()
export class SubscriptionProvisioningService implements SubscriptionProvisioningPort {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepo: SubscriptionRepository,
    @Inject(SUBSCRIPTION_PLAN_REPOSITORY)
    private readonly planRepo: SubscriptionPlanRepository,
  ) {}

  async allocateDefaultFreeSubscription(
    userId: string,
  ): Promise<SubscriptionModel> {
    const existing = await this.subscriptionRepo.findByUserId(userId);
    if (existing && existing.status === SubscriptionStatus.ACTIVE) {
      return existing;
    }

    const freePlan = await this.planRepo.findByCode(PlanCode.FREE);
    if (!freePlan) {
      throw new NotFoundException('Default Free subscription plan not found');
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscription = await this.subscriptionRepo.create(
      {
        userId,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextPlanId: null,
        autoRenew: true,
      },
      {
        periodStart: now,
        periodEnd,
        totalQuota: freePlan.monthlyQuota,
        usedQuota: 0,
        manualUsage: 0,
        webhookUsage: 0,
        scheduleUsage: 0,
      },
    );

    return subscription;
  }

  async getActiveSubscription(
    userId: string,
  ): Promise<SubscriptionModel | null> {
    const sub = await this.subscriptionRepo.findByUserId(userId);
    if (!sub || sub.status !== SubscriptionStatus.ACTIVE) {
      return null;
    }
    return sub;
  }
}
