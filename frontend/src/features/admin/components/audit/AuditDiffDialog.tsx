import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { QueryFeedback } from "../QueryFeedback";
import { useAdminAuditEvent } from "../../hooks/useAdminAudit";
import {
  auditActionLabels,
  auditDiffRows,
  auditLocalTime,
  auditValueText,
} from "../../utils/audit-view";
import { AuditActor } from "./AuditActor";

export function AuditDiffDialog({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const query = useAdminAuditEvent(eventId);
  const event = query.data;
  const rows = event ? auditDiffRows(event) : [];
  const status = isAxiosError(query.error)
    ? query.error.response?.status
    : undefined;
  const errorText =
    status === 404
      ? "Không tìm thấy sự kiện quản trị."
      : status === 401 || status === 403
        ? "Bạn không có quyền xem nhật ký quản trị."
        : "Không thể tải chi tiết sự kiện.";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {event
              ? auditActionLabels[event.action]
              : "Chi tiết nhật ký quản trị"}
          </DialogTitle>
          <DialogDescription>{eventId}</DialogDescription>
        </DialogHeader>
        <QueryFeedback
          pending={query.isLoading}
          error={query.isError}
          loadingText="Đang tải sự kiện…"
          errorText={errorText}
          onRetry={() => {
            void query.refetch();
          }}
        />
        {event && !query.isError && (
          <div className="space-y-5">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Người thực hiện
                </dt>
                <dd className="mt-1">
                  <AuditActor event={event} />
                </dd>
                <dd className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  {event.actorId ??
                    (event.actorType === "SYSTEM"
                      ? "SYSTEM"
                      : "Không ghi nhận")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tài nguyên</dt>
                <dd className="mt-1 text-sm">
                  {event.targetName ?? "Không có metadata"} · {event.targetType}
                </dd>
                <dd className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  {event.targetId}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Thời điểm UTC</dt>
                <dd className="mt-1 break-all text-sm">{event.createdAt}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Thời điểm local
                </dt>
                <dd className="mt-1 text-sm">
                  {auditLocalTime(event.createdAt)}
                </dd>
              </div>
            </dl>
            <section className="space-y-2 rounded-md bg-muted p-3">
              <h2 className="text-sm font-medium">Lý do</h2>
              <p className="whitespace-pre-wrap break-words text-sm">
                {event.reason}
              </p>
            </section>
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Trạng thái trước và sau</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thuộc tính</TableHead>
                    <TableHead>Trước</TableHead>
                    <TableHead>Sau</TableHead>
                    <TableHead>Thay đổi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!rows.length && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        Không có dữ liệu đối chiếu được hỗ trợ.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((row) => (
                    <TableRow key={row.field} data-changed={row.changed}>
                      <TableCell className="font-mono text-xs">
                        {row.field}
                      </TableCell>
                      <TableCell
                        className={cn(row.changed && "bg-destructive/10")}
                      >
                        {auditValueText(row.before)}
                      </TableCell>
                      <TableCell
                        className={cn(row.changed && "bg-emerald-500/10")}
                      >
                        {auditValueText(row.after)}
                      </TableCell>
                      <TableCell>
                        {row.changed ? "Đã thay đổi" : "Không đổi"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
            <p className="text-xs text-muted-foreground">
              Tên người thực hiện và tài nguyên là metadata hiện tại. Giá trị
              trước/sau lấy từ sự kiện đã ghi nhận.
            </p>
          </div>
        )}
        <Button variant="outline" onClick={onClose}>
          Đóng
        </Button>
      </DialogContent>
    </Dialog>
  );
}
