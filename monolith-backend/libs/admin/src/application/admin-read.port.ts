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
export interface ConnectorFilter {
  page: number;
  pageSize: number;
  q?: string;
  authType?: 'NONE' | 'API_KEY' | 'OAUTH2' | 'BASIC';
  isActive?: boolean;
  allowNewCredentials?: boolean;
}
import type {
  NodeTypeFilter,
  NodeTypeAdminPage,
  NodeTypeAdminDetail,
} from './node-type-admin.types';
import type {
  AdminExecutionFilter,
  AdminExecutionPage,
  AdminExecutionDetail,
} from './admin-execution.types';
import type {
  AdminAuditFilter,
  AdminAuditPage,
  AdminAuditDetail,
} from './admin-audit.types';
import type {
  AdminBillingPayment,
  AdminBillingPlan,
  AdminBillingRevenue,
  AdminBillingRevenueFilter,
  AdminBillingSubscription,
  AdminBillingSubscriptionFilter,
  AdminBillingPaymentFilter,
  AdminBillingPage,
} from './admin-billing.types';
export abstract class AdminReadPort {
  abstract auditEvents(filter: AdminAuditFilter): Promise<AdminAuditPage>;
  abstract auditEvent(id: string): Promise<AdminAuditDetail | null>;
  abstract executions(
    filter: AdminExecutionFilter,
  ): Promise<AdminExecutionPage>;
  abstract execution(id: string): Promise<AdminExecutionDetail | null>;
  abstract nodeTypes(filter: NodeTypeFilter): Promise<NodeTypeAdminPage>;
  abstract nodeType(key: string): Promise<NodeTypeAdminDetail>;
  abstract users(filter: UserFilter): Promise<unknown>;
  abstract user(id: string): Promise<unknown>;
  abstract workflows(id: string, filter: UserFilter): Promise<unknown>;
  abstract dashboard(filter: DashboardFilter): Promise<unknown>;
  abstract connectors(filter: ConnectorFilter): Promise<unknown>;
  abstract connector(id: string): Promise<unknown>;
  abstract billingPlans(): Promise<AdminBillingPlan[]>;
  abstract billingSubscriptions(
    filter: AdminBillingSubscriptionFilter,
  ): Promise<AdminBillingPage<AdminBillingSubscription>>;
  abstract billingPayments(
    filter: AdminBillingPaymentFilter,
  ): Promise<AdminBillingPage<AdminBillingPayment>>;
  abstract billingRevenue(
    filter: AdminBillingRevenueFilter,
  ): Promise<AdminBillingRevenue[]>;
}
