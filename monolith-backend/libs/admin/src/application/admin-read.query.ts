import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AdminReadPort } from './admin-read.port';
import type {
  ConnectorFilter,
  DashboardFilter,
  UserFilter,
} from './admin-read.port';

type AdminReadRequest =
  | { kind: 'users'; filter: UserFilter }
  | { kind: 'user'; id: string }
  | { kind: 'workflows'; id: string; filter: UserFilter }
  | { kind: 'dashboard'; filter: DashboardFilter }
  | { kind: 'connectors'; filter: ConnectorFilter }
  | { kind: 'connector'; id: string };
export class AdminReadQuery {
  constructor(readonly request: AdminReadRequest) {}
}
@QueryHandler(AdminReadQuery)
export class AdminReadHandler implements IQueryHandler<AdminReadQuery> {
  constructor(private readonly reads: AdminReadPort) {}
  execute(query: AdminReadQuery): Promise<unknown> {
    const request = query.request;
    switch (request.kind) {
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
    }
  }
}
