import { useQuery } from "@tanstack/react-query";
import { adminService } from "../services/admin.service";
import type { AdminAuditFilter } from "../types/admin-audit.types";
import { useAdminPageVisibility } from "./useAdminPageVisibility";

const AUDIT_POLL_INTERVAL_MS = 30_000;
const DAY_MS = 86_400_000;

export function useAdminAudit(filter: AdminAuditFilter, rollingDays?: number) {
  const visible = useAdminPageVisibility();
  return useQuery({
    queryKey: ["admin", "audit-events", filter, rollingDays],
    queryFn: ({ signal }) => {
      const to = new Date();
      const range = rollingDays
        ? {
            ...filter,
            to: to.toISOString(),
            from: new Date(to.getTime() - rollingDays * DAY_MS).toISOString(),
          }
        : filter;
      return adminService.auditEvents(range, signal);
    },
    enabled: visible,
    refetchInterval: visible ? AUDIT_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
}
export function useAdminAuditEvent(id: string) {
  return useQuery({
    queryKey: ["admin", "audit-event", id],
    queryFn: ({ signal }) => adminService.auditEvent(id, signal),
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });
}
