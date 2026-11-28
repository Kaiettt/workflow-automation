import { PlanCode, SubscriptionStatus } from '@prisma/client';

export interface SubscriptionPlanModel {
  id: string;
  code: PlanCode;
  name: string;
  priceVnd: number;
  monthlyQuota: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SubscriptionModel {
  id: string;
  userId: string;
  planId: string;
  plan?: SubscriptionPlanModel;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextPlanId?: string | null;
  autoRenew: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SubscriptionUsageModel {
  id: string;
  subscriptionId: string;
  periodStart: Date;
  periodEnd: Date;
  totalQuota: number;
  usedQuota: number;
  manualUsage: number;
  webhookUsage: number;
  scheduleUsage: number;
  createdAt?: Date;
  updatedAt?: Date;
}
