export type AdminSubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
export type AdminPaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface AdminBillingPlan {
  id: string;
  code: string;
  name: string;
  priceVnd: number;
  monthlyQuota: number;
  isActive: boolean;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface AdminBillingSubscriptionFilter {
  page: number;
  pageSize: number;
  q?: string;
  status?: AdminSubscriptionStatus;
  planId?: string;
}
export interface AdminBillingPaymentFilter {
  page: number;
  pageSize: number;
  status?: AdminPaymentStatus;
  from?: Date;
  to?: Date;
}
export interface AdminBillingRevenueFilter {
  from: Date;
  to: Date;
}
export interface AdminBillingPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface AdminBillingSubscription {
  id: string;
  userEmail: string;
  status: AdminSubscriptionStatus;
  planId: string;
  planCode: string;
  planName: string;
  monthlyQuota: number;
  usedQuota: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  autoRenew: boolean;
}
export interface AdminBillingPayment {
  id: string;
  orderCode: string;
  userEmail: string;
  planCode: string;
  planName: string;
  amountVnd: number;
  status: AdminPaymentStatus;
  transactionNo: string | null;
  bankCode: string | null;
  payDate: Date | null;
  createdAt: Date;
}
export interface AdminBillingRevenue {
  planId: string;
  planCode: string;
  planName: string;
  orderCount: number;
  revenueVnd: number;
}
export interface UpdateSubscriptionPlanParams {
  planId: string;
  priceVnd?: number;
  monthlyQuota?: number;
  isActive?: boolean;
  expectedRevision: number;
  reason: string;
  adminId: string;
}
