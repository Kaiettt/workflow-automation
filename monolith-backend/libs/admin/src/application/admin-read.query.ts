import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AdminReadPort } from './admin-read.port';
import type {
  ConnectorFilter,
  DashboardFilter,
  UserFilter,
} from './admin-read.port';

import type { NodeTypeFilter } from './node-type-admin.types';
import type { AdminExecutionFilter } from './admin-execution.types';
import type { AdminAuditFilter } from './admin-audit.types';
import type {
  AdminBillingPaymentFilter,
  AdminBillingRevenueFilter,
  AdminBillingSubscriptionFilter,
} from './admin-billing.types';
type AdminReadRequest =
  | { kind: 'auditEvents'; filter: AdminAuditFilter }
  | { kind: 'auditEvent'; id: string }
  | { kind: 'executions'; filter: AdminExecutionFilter }
  | { kind: 'execution'; id: string }
  | { kind: 'nodeTypes'; filter: NodeTypeFilter }
  | { kind: 'nodeType'; key: string }
  | { kind: 'users'; filter: UserFilter }
  | { kind: 'user'; id: string }
  | { kind: 'workflows'; id: string; filter: UserFilter }
  | { kind: 'dashboard'; filter: DashboardFilter }
  | { kind: 'connectors'; filter: ConnectorFilter }
  | { kind: 'connector'; id: string }
  | { kind: 'billingPlans' }
  | { kind: 'billingSubscriptions'; filter: AdminBillingSubscriptionFilter }
  | { kind: 'billingPayments'; filter: AdminBillingPaymentFilter }
  | { kind: 'billingRevenue'; filter: AdminBillingRevenueFilter };
export class AdminReadQuery {
  constructor(readonly request: AdminReadRequest) {}
}
@QueryHandler(AdminReadQuery)
export class AdminReadHandler implements IQueryHandler<AdminReadQuery> {
  constructor(private readonly reads: AdminReadPort) {}
  execute(query: AdminReadQuery): Promise<unknown> {
    const request = query.request;
    switch (request.kind) {
      case 'auditEvents':
        return this.reads.auditEvents(request.filter);
      case 'auditEvent':
        return this.reads.auditEvent(request.id);
      case 'executions':
        return this.reads.executions(request.filter);
      case 'execution':
        return this.reads.execution(request.id);
      case 'nodeTypes':
        return this.reads.nodeTypes(request.filter);
      case 'nodeType':
        return this.reads.nodeType(request.key);
      case 'users':
        return this.reads.users(request.filter);
      case 'user':
        return this.reads.user(request.id);
      case 'workflows':
        return this.reads.workflows(request.id, request.filter);
      case 'dashboard':
        return this.reads.dashboard(request.filter);
      case 'connectors':
        return this.reads.connectors(request.filter);
      case 'connector':
        return this.reads.connector(request.id);
      case 'billingPlans':
        return this.reads.billingPlans();
      case 'billingSubscriptions':
        return this.reads.billingSubscriptions(request.filter);
      case 'billingPayments':
        return this.reads.billingPayments(request.filter);
      case 'billingRevenue':
        return this.reads.billingRevenue(request.filter);
    }
  }
}
