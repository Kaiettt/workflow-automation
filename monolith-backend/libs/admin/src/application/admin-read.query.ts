import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AdminReadPort } from './admin-read.port';
import type { DashboardFilter, UserFilter } from './admin-read.port';

type AdminReadRequest =
  | { kind: 'users'; filter: UserFilter }
  | { kind: 'user'; id: string }
  | { kind: 'workflows'; id: string; filter: UserFilter }
  | { kind: 'dashboard'; filter: DashboardFilter };
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
    }
  }
}
