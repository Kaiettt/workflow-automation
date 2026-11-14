import type { UserRole } from '../../auth/types/auth.types';

export type AccountChangeAction = 'active' | 'role';

export interface Account {
  id: string; name: string; email: string; role: UserRole; isActive: boolean;
  revision: number; createdAt: string; updatedAt: string;
  counts?: { workflows: number; credentials: number; executions: number };
}
export interface UserFilter { page: number; pageSize: number; q?: string; role?: UserRole; isActive?: boolean; }
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number; }
export interface WorkflowSummary { id: string; name: string; status: string; active: boolean; updatedAt: string; }
export interface DashboardFilter { from: string; to: string; timezone: string; }
export interface Dashboard {
  updatedAt: string; from: string; to: string; timezone: string;
  users: { total: number; clientsActive: number; clientsInactive: number; adminsActive: number };
  workflows: { total: number; active: number; DRAFT: number; PUBLISHED: number; ARCHIVED: number };
  executions: Record<string, number>; successRate: number | null;
  trend: { day: string; status: string; count: number }[];
  errors: { code: string; count: number }[];
}
