import { Link, useLocation, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { QueryFeedback } from "../components/QueryFeedback";
import { ExecutionStatusBadge } from "../components/executions/ExecutionStatusBadge";
import { NodeLogsTimeline } from "../components/executions/NodeLogsTimeline";
import { useAdminExecution } from "../hooks/useAdminExecutions";
import { executionDuration, executionTime } from "../utils/execution-format";

export function ExecutionDetailPage() {
  const { id = "" } = useParams();
  const { search } = useLocation();
  const query = useAdminExecution(id);
  const execution = query.data;
  const status = isAxiosError(query.error)
    ? query.error.response?.status
    : undefined;
  const errorText =
    status === 404
      ? "Không tìm thấy lượt thực thi."
      : status === 401 || status === 403
        ? "Bạn không có quyền xem execution này."
        : "Không thể tải chi tiết execution.";
  return (
    <div className="space-y-6">
      <Link
        to={`/admin/executions${search}`}
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        Danh sách execution
      </Link>
      <AdminPageHeader
        title="Chi tiết execution"
        description="Trạng thái, thời gian và kết quả thực thi của từng node."
        eyebrow="Vận hành"
      />
      <QueryFeedback
        pending={query.isLoading}
        error={query.isError}
        loadingText="Đang tải chi tiết execution…"
        errorText={errorText}
        onRetry={() => {
          void query.refetch();
        }}
      />
      {execution && !query.isError && (
        <div className="space-y-6" aria-busy={query.isFetching}>
          <section className="rounded-lg border bg-card p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Tổng quan</h2>
              <ExecutionStatusBadge status={execution.status} />
            </div>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Execution ID", execution.id],
                ["Workflow", execution.workflowName],
                ["Workflow ID", execution.workflowId],
                [
                  "Chủ sở hữu",
                  `${execution.ownerName} · ${execution.ownerEmail}`,
                ],
                ["Owner ID", execution.ownerId],
                ["Phiên bản", String(execution.versionNumber)],
                ["Version ID", execution.versionId],
                ["Trigger", execution.triggerType],
                ["Vào hàng đợi", executionTime(execution.queuedAt)],
                ["Bắt đầu", executionTime(execution.startedAt)],
                ["Kết thúc", executionTime(execution.finishedAt)],
                ["Thời gian chạy", executionDuration(execution.durationMs)],
                ["Mã lỗi", execution.errorCode ?? "—"],
                ["Lý do hủy", execution.cancellationReason ?? "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words text-sm">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <NodeLogsTimeline logs={execution.nodeLogs} />
          <p className="text-xs text-muted-foreground">
            Tự động cập nhật mỗi 30 giây khi tab hiển thị.
          </p>
        </div>
      )}
    </div>
  );
}
