import { apiClient } from '@/shared/api/http-client';
import type { Account, Dashboard, DashboardFilter, Page, UserFilter, WorkflowSummary } from '../types/admin.types';

interface Envelope<T> { success: boolean; data: T; }
export const adminService = {
  async users(filter: UserFilter, signal?: AbortSignal) { return (await apiClient.get<Envelope<Page<Account>>>('/api/admin/users', { params: filter, signal })).data.data; },
  async user(id: string, signal?: AbortSignal) { return (await apiClient.get<Envelope<Account>>(`/api/admin/users/${id}`, { signal })).data.data; },
  async workflows(id: string, page: number, signal?: AbortSignal) { return (await apiClient.get<Envelope<Page<WorkflowSummary>>>(`/api/admin/users/${id}/workflows`, { params: { page, pageSize: 20 }, signal })).data.data; },
  async dashboard(filter: DashboardFilter, signal?: AbortSignal) { return (await apiClient.get<Envelope<Dashboard>>('/api/admin/dashboard', { params: filter, signal })).data.data; },
  async change(account: Account, change: { isActive: boolean } | { role: 'ADMIN' | 'CLIENT' }, reason: string) {
    const kind = 'role' in change ? 'role' : 'active';
    return (await apiClient.patch<Envelope<Account>>(`/api/admin/users/${account.id}/${kind}`, { ...change, reason, expectedRevision: account.revision })).data.data;
  },
};
