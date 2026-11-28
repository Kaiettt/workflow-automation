import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import type { BillingPaymentFilter, BillingSubscriptionFilter, UpdateBillingPlanPayload } from '../types/admin.types';

export const adminBillingKeys = {
  plans: ['admin', 'billing', 'plans'] as const,
  subscriptions: (filter: BillingSubscriptionFilter) => ['admin', 'billing', 'subscriptions', filter] as const,
  payments: (filter: BillingPaymentFilter) => ['admin', 'billing', 'payments', filter] as const,
  revenue: (from: string, to: string) => ['admin', 'billing', 'revenue', from, to] as const,
};

export function useAdminBillingPlans() {
  return useQuery({ queryKey: adminBillingKeys.plans, queryFn: ({ signal }) => adminService.billingPlans(signal) });
}
export function useUpdateBillingPlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBillingPlanPayload }) => adminService.updateBillingPlan(id, payload),
    onSuccess: () => client.invalidateQueries({ queryKey: adminBillingKeys.plans }),
    onError: () => client.invalidateQueries({ queryKey: adminBillingKeys.plans }),
  });
}
export function useAdminBillingSubscriptions(filter: BillingSubscriptionFilter) {
  return useQuery({ queryKey: adminBillingKeys.subscriptions(filter), queryFn: ({ signal }) => adminService.billingSubscriptions(filter, signal), placeholderData: keepPreviousData });
}
export function useAdminBillingPayments(filter: BillingPaymentFilter) {
  return useQuery({ queryKey: adminBillingKeys.payments(filter), queryFn: ({ signal }) => adminService.billingPayments(filter, signal), placeholderData: keepPreviousData });
}
export function useAdminBillingRevenue(from: string, to: string) {
  return useQuery({ queryKey: adminBillingKeys.revenue(from, to), queryFn: ({ signal }) => adminService.billingRevenue(from, to, signal), enabled: Boolean(from && to && from < to) });
}
