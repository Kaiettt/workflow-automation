import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { adminService } from "../services/admin.service";
import type { AdminExecutionFilter } from "../types/admin-execution.types";

const EXECUTION_POLL_INTERVAL_MS = 30_000;
const DAY_MS = 86_400_000;
function subscribeVisibility(listener: () => void) {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}
function useExecutionVisibility() {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== "hidden",
    () => false,
  );
}

export function useAdminExecutions(
  filter: AdminExecutionFilter,
  rollingDays?: number,
) {
  const visible = useExecutionVisibility();
  return useQuery({
    queryKey: ["admin", "executions", filter, rollingDays],
    queryFn: ({ signal }) => {
      const to = new Date();
      const range = rollingDays
        ? {
            ...filter,
            to: to.toISOString(),
            from: new Date(to.getTime() - rollingDays * DAY_MS).toISOString(),
          }
        : filter;
      return adminService.executions(range, signal);
    },
    enabled: visible,
    refetchInterval: visible ? EXECUTION_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
}
export function useAdminExecution(id: string) {
  const visible = useExecutionVisibility();
  return useQuery({
    queryKey: ["admin", "execution", id],
    queryFn: ({ signal }) => adminService.execution(id, signal),
    enabled: visible && Boolean(id),
    refetchInterval: visible ? EXECUTION_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
}
