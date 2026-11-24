export const ADMIN_AUDIT_ACTIONS = [
  'USER_SUSPENDED',
  'USER_REACTIVATED',
  'USER_ROLE_CHANGED',
  'ADMIN_BOOTSTRAPPED',
  'CONNECTOR_POLICY_CHANGED',
  'NODE_TYPE_STATUS_CHANGED',
] as const;
export const ADMIN_AUDIT_ACTOR_TYPES = ['ADMIN', 'SYSTEM'] as const;
export const ADMIN_AUDIT_TARGET_TYPES = [
  'USER',
  'CONNECTOR',
  'NODE_TYPE',
] as const;
export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];
export type AdminAuditActorType = (typeof ADMIN_AUDIT_ACTOR_TYPES)[number];
export type AdminAuditTargetType = (typeof ADMIN_AUDIT_TARGET_TYPES)[number];
export interface AdminAuditFilter {
  page: number;
  pageSize: number;
  from: Date;
  to: Date;
  actorId?: string;
  actorType?: AdminAuditActorType;
  action?: AdminAuditAction;
  targetType?: AdminAuditTargetType;
  targetId?: string;
}
export interface AdminAuditSummary {
  id: string;
  actorType: AdminAuditActorType | 'UNKNOWN';
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: AdminAuditAction | 'UNKNOWN_ACTION';
  targetType: AdminAuditTargetType | 'UNKNOWN';
  targetId: string;
  targetName: string | null;
  reason: string;
  createdAt: Date;
}
export interface AdminAuditPage {
  items: AdminAuditSummary[];
  total: number;
  page: number;
  pageSize: number;
}
export type AdminAuditField =
  | 'role'
  | 'isActive'
  | 'revision'
  | 'allowNewCredentials'
  | 'isCatalogVisible'
  | 'isExecutionAllowed';
export type AdminAuditValue = 'ADMIN' | 'CLIENT' | boolean | number | null;
export type AdminAuditSnapshot = Partial<
  Record<AdminAuditField, AdminAuditValue>
>;
export interface AdminAuditDetail extends AdminAuditSummary {
  before: AdminAuditSnapshot;
  after: AdminAuditSnapshot;
}
export function isAdminAuditAction(value: string): value is AdminAuditAction {
  return ADMIN_AUDIT_ACTIONS.some((action) => action === value);
}
