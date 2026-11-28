import { Inject, Injectable } from '@nestjs/common';
import { PlanCode, SubscriptionStatus } from '@prisma/client';
import {
  SUBSCRIPTION_PLAN_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
} from '../../domain/repositories';
import type {
  SubscriptionPlanRepository,
  SubscriptionRepository,
} from '../../domain/repositories';

const BILLING_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export class SubscriptionLifecycleError extends Error {}

@Injectable()
export class SubscriptionLifecycleService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: SubscriptionRepository,
    @Inject(SUBSCRIPTION_PLAN_REPOSITORY)
    private readonly planRepository: SubscriptionPlanRepository,
  ) {}

  async handlePaymentCompleted(event: {
    readonly userId: string;
    readonly planId: string;
    readonly orderCode: string;
  }): Promise<void> {
    const plan = await this.planRepository.findById(event.planId);
    if (!plan || !plan.isActive) {
      throw new SubscriptionLifecycleError(
        `Active subscription plan not found: ${event.planId}`,
      );
    }
    const periodStart = new Date();
    await this.subscriptionRepository.applyPaidPlan({
      userId: event.userId,
      planId: plan.id,
      orderCode: event.orderCode,
      periodStart,
      periodEnd: new Date(periodStart.getTime() + BILLING_PERIOD_MS),
      totalQuota: plan.monthlyQuota,
    });
  }

  async scheduleDowngrade(
    userId: string,
    targetPlanCode: PlanCode,
  ): Promise<void> {
    const subscription = await this.subscriptionRepository.findByUserId(userId);
    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new SubscriptionLifecycleError(
        'An active subscription is required to schedule a downgrade',
      );
    }
    const target = await this.planRepository.findByCode(targetPlanCode);
    if (
      !target ||
      !target.isActive ||
      target.priceVnd >= (subscription.plan?.priceVnd ?? 0)
    ) {
      throw new SubscriptionLifecycleError(
        'The selected plan is not a lower active plan',
      );
    }
    await this.subscriptionRepository.update(subscription.id, {
      nextPlanId: target.id,
      autoRenew: true,
    });
  }

  async cancelRenewal(userId: string): Promise<void> {
    const subscription = await this.subscriptionRepository.findByUserId(userId);
    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new SubscriptionLifecycleError(
        'An active subscription is required to cancel renewal',
      );
    }
    if (subscription.plan?.code === PlanCode.FREE) {
      throw new SubscriptionLifecycleError(
        'Free plan renewal cannot be cancelled',
      );
    }
    await this.subscriptionRepository.update(subscription.id, {
      autoRenew: false,
      nextPlanId: null,
    });
  }

  async switchToFree(userId: string): Promise<void> {
    const subscription = await this.subscriptionRepository.findByUserId(userId);
    if (!subscription || subscription.status !== SubscriptionStatus.EXPIRED) {
      throw new SubscriptionLifecycleError(
        'Only an expired subscription can switch to Free',
      );
    }
    const freePlan = await this.planRepository.findByCode(PlanCode.FREE);
    if (!freePlan || !freePlan.isActive) {
      throw new SubscriptionLifecycleError('Active Free plan not found');
    }
    const periodStart = new Date();
    await this.subscriptionRepository.activateFreePlan({
      userId,
      planId: freePlan.id,
      periodStart,
      periodEnd: new Date(periodStart.getTime() + BILLING_PERIOD_MS),
      totalQuota: freePlan.monthlyQuota,
    });
  }

  runScheduledLifecycle(now = new Date()): Promise<void> {
    return this.subscriptionRepository.applyDueLifecycleTransitions(now);
  }
}
