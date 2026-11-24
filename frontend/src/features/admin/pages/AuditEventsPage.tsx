import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { PageControls } from "../components/PageControls";
import { QueryFeedback } from "../components/QueryFeedback";
import { DashboardRangeFilter } from "../components/dashboard/DashboardRangeFilter";
import { AuditEventFilterBar } from "../components/audit/AuditEventFilterBar";
import { AuditEventTable } from "../components/audit/AuditEventTable";
import { AuditDiffDialog } from "../components/audit/AuditDiffDialog";
import { useAdminAudit } from "../hooks/useAdminAudit";
import {
  auditActions,
  auditActorTypes,
  auditTargetTypes,
  type AdminAuditFilter,
} from "../types/admin-audit.types";

export function AuditEventsPage() {
  const [initialRangeEnd] = useState(() => Date.now());
  const [params, setParams] = useSearchParams();
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
  const filter: AdminAuditFilter = {
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize,
    actorId: params.get("actorId") || undefined,
    targetId: params.get("targetId") || undefined,
    action: auditActions.find((action) => action === params.get("action")),
    actorType: auditActorTypes.find((type) => type === params.get("actorType")),
    targetType: auditTargetTypes.find(
      (type) => type === params.get("targetType"),
    ),
    from: custom ? params.get("from") || undefined : undefined,
    to: custom ? params.get("to") || undefined : undefined,
  };
  const query = useAdminAudit(filter, rollingDays);
  function update(values: Record<string, string>, keepPage = false) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [name, value] of Object.entries(values)) {
          if (value) next.set(name, value);
          else next.delete(name);
        }
        if (!keepPage) {
          next.delete("page");
          next.delete("eventId");
        }
        return next;
      },
      { replace: true },
    );
  }
  const fallbackTo = new Date(
    query.dataUpdatedAt || initialRangeEnd,
  ).toISOString();
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
  const eventId = params.get("eventId");
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Nhật ký quản trị"
        description="Tra cứu người thực hiện, lý do và trạng thái trước/sau của các thay đổi quản trị."
        eyebrow="Kiểm toán"
      />
      <AuditEventFilterBar
        filter={filter}
        onChange={(name, value) => update({ [name]: value })}
        onIds={(actorId, targetId) => update({ actorId, targetId })}
      />
      <DashboardRangeFilter
        activityLabel="Nhật ký quản trị"
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
        Tự động cập nhật danh sách mỗi 30 giây khi tab hiển thị.
      </p>
      <QueryFeedback
        pending={query.isLoading}
        error={query.isError}
        loadingText="Đang tải nhật ký…"
        errorText="Không thể tải nhật ký quản trị. Kiểm tra bộ lọc và quyền truy cập."
        onRetry={() => {
          void query.refetch();
        }}
      />
      {query.data && !query.isError && (
        <div className="space-y-3" aria-busy={query.isFetching}>
          <AuditEventTable
            events={query.data.items}
            onDetail={(id) => update({ eventId: id }, true)}
          />
          <PageControls
            page={filter.page}
            pageSize={filter.pageSize}
            total={query.data.total}
            onChange={(next) => update({ page: String(next) }, true)}
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="audit-page-size">Số dòng mỗi trang</Label>
            <select
              id="audit-page-size"
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
      {eventId && (
        <AuditDiffDialog
          key={eventId}
          eventId={eventId}
          onClose={() => update({ eventId: "" }, true)}
        />
      )}
    </div>
  );
}
