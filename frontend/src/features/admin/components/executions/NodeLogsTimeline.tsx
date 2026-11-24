import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminExecutionNodeLog } from "../../types/admin-execution.types";
import { executionDuration, executionTime } from "../../utils/execution-format";
import { ExecutionStatusBadge } from "./ExecutionStatusBadge";

export function NodeLogsTimeline({ logs }: { logs: AdminExecutionNodeLog[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Tiến trình các node</h2>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "Node ID",
                "Node Key",
                "Trạng thái",
                "Bắt đầu",
                "Kết thúc",
                "Thời gian chạy",
                "Số lần thử lại",
                "Mã lỗi",
              ].map((label) => (
                <TableHead key={label}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!logs.length && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  Chưa có node log được ghi nhận.
                </TableCell>
              </TableRow>
            )}
            {logs.map((log) => (
              <TableRow key={log.nodeId}>
                <TableCell className="font-mono text-xs">
                  {log.nodeId}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {log.nodeKey}
                </TableCell>
                <TableCell>
                  <ExecutionStatusBadge status={log.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {executionTime(log.startedAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {executionTime(log.finishedAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {executionDuration(log.durationMs)}
                </TableCell>
                <TableCell className="tabular-nums">{log.retryCount}</TableCell>
                <TableCell className="font-mono text-xs">
                  {log.errorCode ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
