import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import type { Account, DashboardFilter, UserFilter } from '../types/admin.types';

export function useUsers(filter: UserFilter) {
  return useQuery({ queryKey: ['admin', 'users', filter], queryFn: ({ signal }) => adminService.users(filter, signal) });
}
export function useAccount(id: string) {
  return useQuery({ queryKey: ['admin', 'user', id], queryFn: ({ signal }) => adminService.user(id, signal), enabled: Boolean(id) });
}
export function useAccountWorkflows(id: string, page: number) {
  return useQuery({ queryKey: ['admin', 'workflows', id, page], queryFn: ({ signal }) => adminService.workflows(id, page, signal), enabled: Boolean(id) });
}
export function useDashboard(filter: DashboardFilter, rollingDays?: number) {
  return useQuery({ queryKey: ['admin', 'dashboard', filter, rollingDays], queryFn: ({ signal }) => {
    const to = new Date();
    const range = rollingDays ? { ...filter, to: to.toISOString(), from: new Date(to.getTime() - rollingDays * 86400000).toISOString() } : filter;
    return adminService.dashboard(range, signal);
  }, refetchInterval: 30000, refetchIntervalInBackground: false });
}
export function useChangeAccount() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: { account: Account; change: { isActive: boolean } | { role: 'ADMIN' | 'CLIENT' }; reason: string }) => adminService.change(input.account, input.change, input.reason),
    onSettled: () => client.invalidateQueries({ queryKey: ['admin'] }),
  });
}
