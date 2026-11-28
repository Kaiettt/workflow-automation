import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/http-client';
import type { BillingPlan, CurrentSubscription, PaymentOrder, PlanCode } from '../types/billing.types';

interface ApiResponse<T> { success: boolean; data: T }
interface CheckoutResult { paymentUrl: string; orderCode: string }

export const billingKeys = {
  subscription: ['billing', 'subscription'] as const,
  plans: ['billing', 'plans'] as const,
  history: ['billing', 'history'] as const,
  order: (txnRef: string) => ['billing', 'order', txnRef] as const,
};

export const billingApi = {
  getSubscription: async (signal?: AbortSignal) =>
    (await apiClient.get<ApiResponse<CurrentSubscription | null>>('/api/billing/subscription/me', { signal })).data.data,
  getPlans: async (signal?: AbortSignal) =>
    (await apiClient.get<ApiResponse<BillingPlan[]>>('/api/billing/plans', { signal })).data.data,
  getHistory: async (signal?: AbortSignal) =>
    (await apiClient.get<ApiResponse<PaymentOrder[]>>('/api/billing/payments/history', { signal })).data.data,
  getOrder: async (txnRef: string, signal?: AbortSignal) =>
    (await apiClient.get<ApiResponse<PaymentOrder>>(`/api/billing/payment-orders/${encodeURIComponent(txnRef)}`, { signal })).data.data,
  checkout: async (planId: string) =>
    (await apiClient.post<ApiResponse<CheckoutResult>>('/api/billing/checkout', { planId })).data.data,
  scheduleDowngrade: async (targetPlanCode: PlanCode) =>
    apiClient.post('/api/billing/subscription/downgrade', { targetPlanCode }),
  switchToFree: async () => apiClient.post('/api/billing/subscription/switch-to-free'),
};

export function useBillingSubscription() {
  return useQuery({ queryKey: billingKeys.subscription, queryFn: ({ signal }) => billingApi.getSubscription(signal) });
}

export function useBillingPlans() {
  return useQuery({ queryKey: billingKeys.plans, queryFn: ({ signal }) => billingApi.getPlans(signal) });
}

export function usePaymentHistory() {
  return useQuery({ queryKey: billingKeys.history, queryFn: ({ signal }) => billingApi.getHistory(signal) });
}

export function usePaymentOrder(txnRef: string) {
  return useQuery({
    queryKey: billingKeys.order(txnRef),
    queryFn: ({ signal }) => billingApi.getOrder(txnRef, signal),
    enabled: Boolean(txnRef),
    retry: false,
    refetchInterval: (query) => query.state.data?.status === 'PENDING' && query.state.dataUpdateCount < 10 ? 2_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useBillingActions() {
  const queryClient = useQueryClient();
  const checkout = useMutation({ mutationFn: billingApi.checkout });
  const downgrade = useMutation({ mutationFn: billingApi.scheduleDowngrade, onSuccess: () => queryClient.invalidateQueries({ queryKey: billingKeys.subscription }) });
  const switchToFree = useMutation({ mutationFn: billingApi.switchToFree, onSuccess: () => queryClient.invalidateQueries({ queryKey: billingKeys.subscription }) });
  return { checkout, downgrade, switchToFree };
}
