export type PlanCode = 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface BillingPlan {
  id: string;
  code: PlanCode;
  name: string;
  priceVnd: number;
  monthlyQuota: number;
  isActive: boolean;
}

export interface CurrentSubscription {
  id: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextPlanId: string | null;
  autoRenew: boolean;
  plan: BillingPlan;
  usage: {
    totalQuota: number;
    usedQuota: number;
    manualUsage: number;
    webhookUsage: number;
    scheduleUsage: number;
  } | null;
}

export interface PaymentOrder {
  id: string;
  orderCode: string;
  amountVnd: number;
  status: PaymentStatus;
  createdAt: string;
  payDate: string | null;
}
