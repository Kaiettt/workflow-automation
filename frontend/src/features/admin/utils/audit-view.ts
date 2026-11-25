import type {
  AdminAuditDetail,
  AdminAuditSummary,
  AuditAction,
  AuditField,
  AuditSnapshot,
  AuditValue,
} from "../types/admin-audit.types";

export const auditActionLabels: Record<AdminAuditSummary["action"], string> = {
  USER_SUSPENDED: "Khóa tài khoản",
  USER_REACTIVATED: "Mở khóa tài khoản",
  USER_ROLE_CHANGED: "Đổi vai trò",
  ADMIN_BOOTSTRAPPED: "Khởi tạo Admin",
  CONNECTOR_POLICY_CHANGED: "Đổi chính sách connector",
  NODE_TYPE_STATUS_CHANGED: "Đổi chính sách loại node",
  UNKNOWN_ACTION: "Hành động không được hỗ trợ",
};
const fieldsByAction: Record<AuditAction, readonly AuditField[]> = {
  USER_SUSPENDED: ["role", "isActive", "revision"],
  USER_REACTIVATED: ["role", "isActive", "revision"],
  USER_ROLE_CHANGED: ["role", "isActive", "revision"],
  ADMIN_BOOTSTRAPPED: ["role", "isActive"],
  CONNECTOR_POLICY_CHANGED: ["allowNewCredentials", "revision"],
  NODE_TYPE_STATUS_CHANGED: [
    "isCatalogVisible",
    "isExecutionAllowed",
    "revision",
  ],
};
function stateValue(
  snapshot: AuditSnapshot,
  field: AuditField,
): AuditValue | undefined {
  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    Array.isArray(snapshot) ||
    !Object.hasOwn(snapshot, field)
  )
    return undefined;
  const value: unknown = snapshot[field];
  if (value === null) return null;
  if (field === "role")
    return value === "ADMIN" || value === "CLIENT" ? value : undefined;
  if (field === "revision")
    return typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0
      ? value
      : undefined;
  return typeof value === "boolean" ? value : undefined;
}
export function auditDiffRows(event: AdminAuditDetail) {
  const fields =
    event.action === "UNKNOWN_ACTION" ? [] : fieldsByAction[event.action];
  return fields.map((field) => {
    const before = stateValue(event.before, field);
    const after = stateValue(event.after, field);
    return { field, before, after, changed: before !== after };
  });
}
export function auditValueText(value: AuditValue | undefined) {
  return value === undefined
    ? "Không ghi nhận"
    : value === null
      ? "null"
      : String(value);
}
export function auditLocalTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", { timeZoneName: "short" });
}
