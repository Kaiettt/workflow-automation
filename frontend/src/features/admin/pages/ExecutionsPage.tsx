import { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { PageControls } from "../components/PageControls";
import { QueryFeedback } from "../components/QueryFeedback";
import { DashboardRangeFilter } from "../components/dashboard/DashboardRangeFilter";
import { ExecutionFilterBar } from "../components/executions/ExecutionFilterBar";
import { ExecutionTable } from "../components/executions/ExecutionTable";
import { useAdminExecutions } from "../hooks/useAdminExecutions";
import {
  executionStatuses,
  executionTriggerTypes,
  type AdminExecutionFilter,
} from "../types/admin-execution.types";

export function ExecutionsPage() {
  const [initialRangeEnd] = useState(() => Date.now());
  const [params, setParams] = useSearchParams();
  const { search } = useLocation();
  const page = Number(params.get("page") ?? 1);
  const pageSize =
    params.get("pageSize") === "100"
      ? 100
      : params.get("pageSize") === "50"
        ? 50
        : 20;
  const custom = params.has("from") || params.has("to");
  const rollingDays = custom
    ? undefined
    : params.get("days") === "1"
      ? 1
      : params.get("days") === "30"
        ? 30
        : 7;
  const filter: AdminExecutionFilter = {
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize,
    ownerId: params.get("ownerId") || undefined,
    workflowId: params.get("workflowId") || undefined,
    executionId: params.get("executionId") || undefined,
    status: executionStatuses.find((status) => status === params.get("status")),
    triggerType: executionTriggerTypes.find(
      (trigger) => trigger === params.get("triggerType"),
    ),
    from: custom ? params.get("from") || undefined : undefined,
    to: custom ? params.get("to") || undefined : undefined,
  };
  const query = useAdminExecutions(filter, rollingDays);
  function update(values: Record<string, string>, paging = false) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [name, value] of Object.entries(values)) {
          if (value) next.set(name, value);
          else next.delete(name);
        }
        if (!paging) next.delete("page");
        return next;
      },
      { replace: true },
    );
  }
  const fallbackTo = new Date(query.dataUpdatedAt || initialRangeEnd).toISOString();
  const to =
    filter.to && Number.isFinite(Date.parse(filter.to))
      ? filter.to
      : fallbackTo;
  const fallbackFrom = new Date(
    new Date(to).getTime() - (rollingDays ?? 7) * 86400000,
  ).toISOString();
  const from =
    filter.from && Number.isFinite(Date.parse(filter.from))
      ? filter.from
      : fallbackFrom;
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Giám sát execution"
        description="Tra cứu các lượt chạy trên toàn nền tảng và tiến trình từng node."
        eyebrow="Vận hành"
      />
      <ExecutionFilterBar
        filter={filter}
        onChange={(name, value) => update({ [name]: value })}
        onIds={(workflowId, executionId) => update({ workflowId, executionId })}
      />
      <DashboardRangeFilter
        filter={{
          from,
          to,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }}
        rollingDays={rollingDays}
        onPreset={(days) => update({ days: String(days), from: "", to: "" })}
        onApply={(range) =>
          update({ from: range.from, to: range.to, days: "" })
        }
      />
      <p className="text-xs text-muted-foreground">
        Tự động cập nhật mỗi 30 giây khi tab hiển thị.
      </p>
      <QueryFeedback
        pending={query.isLoading}
        error={query.isError}
        loadingText="Đang tải execution…"
        errorText="Không thể tải execution. Kiểm tra bộ lọc và quyền truy cập."
        onRetry={() => {
          void query.refetch();
        }}
      />
      {query.data && !query.isError && (
        <div className="space-y-3" aria-busy={query.isFetching}>
          <ExecutionTable executions={query.data.items} search={search} />
          <PageControls
            page={filter.page}
            pageSize={filter.pageSize}
            total={query.data.total}
            onChange={(next) => update({ page: String(next) }, true)}
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="execution-page-size">Số dòng mỗi trang</Label>
            <select
              id="execution-page-size"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={filter.pageSize}
              onChange={(event) => update({ pageSize: event.target.value })}
            >
              {[20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
