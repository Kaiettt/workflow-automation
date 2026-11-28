import type {
  AdminAuditAction,
  AdminAuditField,
  AdminAuditSnapshot,
  AdminAuditSummary,
} from './admin-audit.types';

const fieldsByAction: Record<AdminAuditAction, readonly AdminAuditField[]> = {
  USER_SUSPENDED: ['role', 'isActive', 'revision'],
  USER_REACTIVATED: ['role', 'isActive', 'revision'],
  USER_ROLE_CHANGED: ['role', 'isActive', 'revision'],
  ADMIN_BOOTSTRAPPED: ['role', 'isActive'],
  CONNECTOR_POLICY_CHANGED: ['allowNewCredentials', 'revision'],
  NODE_TYPE_STATUS_CHANGED: [
    'isCatalogVisible',
    'isExecutionAllowed',
    'revision',
  ],
  SUBSCRIPTION_PLAN_CHANGED: [
    'priceVnd',
    'monthlyQuota',
    'isActive',
    'revision',
  ],
};
const targetByAction = {
  USER_SUSPENDED: 'USER',
  USER_REACTIVATED: 'USER',
  USER_ROLE_CHANGED: 'USER',
  ADMIN_BOOTSTRAPPED: 'USER',
  CONNECTOR_POLICY_CHANGED: 'CONNECTOR',
  NODE_TYPE_STATUS_CHANGED: 'NODE_TYPE',
  SUBSCRIPTION_PLAN_CHANGED: 'SUBSCRIPTION_PLAN',
} satisfies Record<AdminAuditAction, string>;
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function projectAdminAuditSnapshot(
  action: AdminAuditSummary['action'],
  targetType: AdminAuditSummary['targetType'],
  value: unknown,
): AdminAuditSnapshot {
  const result: AdminAuditSnapshot = {};
  if (
    action === 'UNKNOWN_ACTION' ||
    targetByAction[action] !== targetType ||
    !isObject(value)
  )
    return result;
  for (const field of fieldsByAction[action]) {
    if (!Object.hasOwn(value, field)) continue;
    const entry = value[field];
    if (entry === null) result[field] = null;
    else if (field === 'role') {
      if (entry === 'ADMIN' || entry === 'CLIENT') result[field] = entry;
    } else if (field === 'revision') {
      if (
        typeof entry === 'number' &&
        Number.isSafeInteger(entry) &&
        entry >= 0
      )
        result[field] = entry;
    } else if (field === 'priceVnd' || field === 'monthlyQuota') {
      if (
        typeof entry === 'number' &&
        Number.isSafeInteger(entry) &&
        entry >= 0
      )
        result[field] = entry;
    } else if (typeof entry === 'boolean') result[field] = entry;
  }
  return result;
}
