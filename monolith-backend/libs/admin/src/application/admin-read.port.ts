export interface UserFilter {
  page: number;
  pageSize: number;
  q?: string;
  role?: 'ADMIN' | 'CLIENT';
  isActive?: boolean;
}
export interface DashboardFilter {
  from: Date;
  to: Date;
  timezone: string;
}
export abstract class AdminReadPort {
  abstract users(filter: UserFilter): Promise<unknown>;
  abstract user(id: string): Promise<unknown>;
  abstract workflows(id: string, filter: UserFilter): Promise<unknown>;
  abstract dashboard(filter: DashboardFilter): Promise<unknown>;
}
