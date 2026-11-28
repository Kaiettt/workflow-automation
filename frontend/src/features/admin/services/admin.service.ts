import { apiClient } from '@/shared/api/http-client';
import type {
  Account,
  AdminAuditFilter,
  AdminAuditSummary,
  AdminAuditDetail,
  AdminExecutionFilter,
  AdminExecutionSummary,
  AdminExecutionDetail,
  NodeTypeAdminItem,
  NodeTypeAdminDetail,
  NodeTypeFilter,
  NodeTypePolicySnapshot,
  ChangeNodeTypeStatusPayload,
  ChangeConnectorPolicyPayload,
  ConnectorAdminDetail,
  ConnectorAdminItem,
  ConnectorFilter,
  Dashboard,
  DashboardFilter,
  Page,
  UserFilter,
  WorkflowSummary,
  BillingPlanAdmin,
  BillingPaymentAdmin,
  BillingRevenueAdmin,
  BillingSubscriptionAdmin,
  BillingSubscriptionFilter,
  BillingPaymentFilter,
  UpdateBillingPlanPayload,
} from '../types/admin.types';

interface Envelope<T> { success: boolean; data: T; }
export const adminService = {
  async auditEvents(filter: AdminAuditFilter, signal?: AbortSignal) {
    return (await apiClient.get<Envelope<Page<AdminAuditSummary>>>('/api/admin/audit-events', { params: filter, signal })).data.data;
  },
  async auditEvent(id: string, signal?: AbortSignal) {
    return (await apiClient.get<Envelope<AdminAuditDetail>>(`/api/admin/audit-events/${encodeURIComponent(id)}`, { signal })).data.data;
  },
  async executions(filter: AdminExecutionFilter, signal?: AbortSignal) {
    return (await apiClient.get<Envelope<Page<AdminExecutionSummary>>>('/api/admin/executions', { params: filter, signal })).data.data;
  },
  async execution(id: string, signal?: AbortSignal) {
    return (await apiClient.get<Envelope<AdminExecutionDetail>>(`/api/admin/executions/${encodeURIComponent(id)}`, { signal })).data.data;
  },
  async nodeTypes(filter: NodeTypeFilter, signal?: AbortSignal) {
    return (await apiClient.get<Envelope<Page<NodeTypeAdminItem>>>('/api/admin/node-types', { params: filter, signal })).data.data;
  },
  async nodeType(key: string, signal?: AbortSignal) {
    return (await apiClient.get<Envelope<NodeTypeAdminDetail>>(`/api/admin/node-types/${encodeURIComponent(key)}`, { signal })).data.data;
  },
  async changeNodeTypeStatus(key: string, payload: ChangeNodeTypeStatusPayload) {
    return (await apiClient.patch<Envelope<NodeTypePolicySnapshot>>(`/api/admin/node-types/${encodeURIComponent(key)}/status`, payload)).data.data;
  },
  async users(filter: UserFilter, signal?: AbortSignal) { return (await apiClient.get<Envelope<Page<Account>>>('/api/admin/users', { params: filter, signal })).data.data; },
  async user(id: string, signal?: AbortSignal) { return (await apiClient.get<Envelope<Account>>(`/api/admin/users/${id}`, { signal })).data.data; },
  async workflows(id: string, page: number, signal?: AbortSignal) { return (await apiClient.get<Envelope<Page<WorkflowSummary>>>(`/api/admin/users/${id}/workflows`, { params: { page, pageSize: 20 }, signal })).data.data; },
  async dashboard(filter: DashboardFilter, signal?: AbortSignal) { return (await apiClient.get<Envelope<Dashboard>>('/api/admin/dashboard', { params: filter, signal })).data.data; },
  async change(account: Account, change: { isActive: boolean } | { role: 'ADMIN' | 'CLIENT' }, reason: string) {
    const kind = 'role' in change ? 'role' : 'active';
    return (await apiClient.patch<Envelope<Account>>(`/api/admin/users/${account.id}/${kind}`, { ...change, reason, expectedRevision: account.revision })).data.data;
  },
  async connectors(filter: ConnectorFilter, signal?: AbortSignal) {
    return (await apiClient.get<Envelope<Page<ConnectorAdminItem>>>('/api/admin/connectors', { params: filter, signal })).data.data;
  },
  async connector(id: string, signal?: AbortSignal) {
    return (await apiClient.get<Envelope<ConnectorAdminDetail>>(`/api/admin/connectors/${id}`, { signal })).data.data;
  },
  async changeConnectorPolicy(id: string, payload: ChangeConnectorPolicyPayload) {
    return (await apiClient.patch<Envelope<ConnectorAdminItem>>(`/api/admin/connectors/${id}/credential-policy`, payload)).data.data;
  },
  async billingPlans(signal?: AbortSignal) {
    return (await apiClient.get<Envelope<BillingPlanAdmin[]>>('/api/admin/billing/plans', { signal })).data.data;
  },
  async updateBillingPlan(id: string, payload: UpdateBillingPlanPayload) {
    return (await apiClient.patch<Envelope<BillingPlanAdmin>>(`/api/admin/billing/plans/${encodeURIComponent(id)}`, payload)).data.data;
  },
  async billingSubscriptions(filter: BillingSubscriptionFilter, signal?: AbortSignal) {
    return (await apiClient.get<Envelope<Page<BillingSubscriptionAdmin>>>('/api/admin/billing/subscriptions', { params: filter, signal })).data.data;
  },
  async billingPayments(filter: BillingPaymentFilter, signal?: AbortSignal) {
    return (await apiClient.get<Envelope<Page<BillingPaymentAdmin>>>('/api/admin/billing/payments', { params: filter, signal })).data.data;
  },
  async billingRevenue(from: string, to: string, signal?: AbortSignal) {
    return (await apiClient.get<Envelope<BillingRevenueAdmin[]>>('/api/admin/billing/revenue', { params: { from, to }, signal })).data.data;
  },
};
