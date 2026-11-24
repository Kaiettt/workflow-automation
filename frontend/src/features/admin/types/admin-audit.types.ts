export const auditActions = [
  "USER_SUSPENDED",
  "USER_REACTIVATED",
  "USER_ROLE_CHANGED",
  "ADMIN_BOOTSTRAPPED",
  "CONNECTOR_POLICY_CHANGED",
  "NODE_TYPE_STATUS_CHANGED",
] as const;
export const auditActorTypes = ["ADMIN", "SYSTEM"] as const;
export const auditTargetTypes = ["USER", "CONNECTOR", "NODE_TYPE"] as const;
export type AuditAction = (typeof auditActions)[number];
export type AuditActorType = (typeof auditActorTypes)[number];
export type AuditTargetType = (typeof auditTargetTypes)[number];
export interface AdminAuditFilter {
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
  actorId?: string;
  actorType?: AuditActorType;
  action?: AuditAction;
  targetType?: AuditTargetType;
  targetId?: string;
}
export interface AdminAuditSummary {
  id: string;
  actorType: AuditActorType | "UNKNOWN";
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: AuditAction | "UNKNOWN_ACTION";
  targetType: AuditTargetType | "UNKNOWN";
  targetId: string;
  targetName: string | null;
  reason: string;
  createdAt: string;
}
export type AuditField =
  | "role"
  | "isActive"
  | "revision"
  | "allowNewCredentials"
  | "isCatalogVisible"
  | "isExecutionAllowed";
export type AuditValue = "ADMIN" | "CLIENT" | boolean | number | null;
export type AuditSnapshot = Partial<Record<AuditField, AuditValue>>;
export interface AdminAuditDetail extends AdminAuditSummary {
  before: AuditSnapshot;
  after: AuditSnapshot;
}
