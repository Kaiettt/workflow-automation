import { PlanCode } from '@prisma/client';
import {
  SubscriptionModel,
  SubscriptionPlanModel,
  SubscriptionUsageModel,
} from '../entities';

export const SUBSCRIPTION_REPOSITORY = Symbol('SUBSCRIPTION_REPOSITORY');
export const SUBSCRIPTION_PLAN_REPOSITORY = Symbol(
  'SUBSCRIPTION_PLAN_REPOSITORY',
);

export type QuotaReservationResult =
  | 'RESERVED'
  | 'NO_ACTIVE_SUBSCRIPTION'
  | 'SUBSCRIPTION_EXPIRED'
  | 'NO_ACTIVE_PERIOD'
  | 'QUOTA_EXCEEDED';

export interface SubscriptionRepository {
  findByUserId(userId: string): Promise<SubscriptionModel | null>;
  create(
    data: Omit<SubscriptionModel, 'id' | 'createdAt' | 'updatedAt'>,
    usage: Omit<
      SubscriptionUsageModel,
      'id' | 'subscriptionId' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<SubscriptionModel>;
  update(
    id: string,
    data: Partial<
      Omit<
        SubscriptionModel,
        'id' | 'userId' | 'createdAt' | 'updatedAt' | 'plan'
      >
    >,
  ): Promise<SubscriptionModel>;
  getCurrentUsage(
    subscriptionId: string,
  ): Promise<SubscriptionUsageModel | null>;
  createUsage(
    usage: Omit<SubscriptionUsageModel, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SubscriptionUsageModel>;
  incrementUsage(
    usageId: string,
    triggerType: 'MANUAL' | 'WEBHOOK' | 'SCHEDULE',
  ): Promise<SubscriptionUsageModel>;
  reserveQuota(
    userId: string,
    triggerType: 'MANUAL' | 'WEBHOOK' | 'SCHEDULE',
  ): Promise<QuotaReservationResult>;
  applyPaidPlan(input: {
    userId: string;
    planId: string;
    orderCode: string;
    periodStart: Date;
    periodEnd: Date;
    totalQuota: number;
  }): Promise<void>;
  applyDueLifecycleTransitions(now: Date): Promise<void>;
  activateFreePlan(input: {
    userId: string;
    planId: string;
    periodStart: Date;
    periodEnd: Date;
    totalQuota: number;
  }): Promise<SubscriptionModel>;
}

export interface SubscriptionPlanRepository {
  findByCode(code: PlanCode): Promise<SubscriptionPlanModel | null>;
  findById(id: string): Promise<SubscriptionPlanModel | null>;
  findAllActive(): Promise<SubscriptionPlanModel[]>;
}
