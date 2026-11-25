import { Badge } from "@/components/ui/badge";
import type {
  AdminExecutionStatus,
  AdminExecutionNodeLog,
} from "../../types/admin-execution.types";

type Status = AdminExecutionStatus | AdminExecutionNodeLog["status"];
const labels: Record<Status, string> = {
  QUEUED: "Đang chờ",
  RUNNING: "Đang chạy",
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
  SKIPPED: "Bỏ qua",
  TIMEOUT: "Hết thời gian",
};
export function ExecutionStatusBadge({ status }: { status: Status }) {
  return (
    <Badge
      variant={
        status === "FAILED" || status === "TIMEOUT"
          ? "destructive"
          : status === "SUCCESS"
            ? "secondary"
            : "outline"
      }
    >
      {labels[status]}
    </Badge>
  );
}
