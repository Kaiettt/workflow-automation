export interface AccountChange {
  actorId: string;
  targetId: string;
  expectedRevision: number;
  reason: string;
  role?: 'ADMIN' | 'CLIENT';
  isActive?: boolean;
}

export interface AccountSummary {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'CLIENT';
  isActive: boolean;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class AccountAdministrationPort {
  abstract change(
    input: AccountChange,
  ): Promise<AccountSummary & { auditEventId: string | null }>;
  abstract bootstrap(
    email: string,
    reason: string,
  ): Promise<AccountSummary & { auditEventId: string }>;
}
