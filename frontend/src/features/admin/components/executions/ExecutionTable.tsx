import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminExecutionSummary } from "../../types/admin-execution.types";
import { executionDuration, executionTime } from "../../utils/execution-format";
import { ExecutionStatusBadge } from "./ExecutionStatusBadge";

export function ExecutionTable({
  executions,
  search,
}: {
  executions: AdminExecutionSummary[];
  search: string;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {[
              "Execution ID",
              "Workflow",
              "Chủ sở hữu",
              "Trigger",
              "Trạng thái",
              "Vào hàng đợi",
              "Thời gian chạy",
              "Mã lỗi",
            ].map((label) => (
              <TableHead key={label}>{label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {!executions.length && (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-12 text-center text-muted-foreground"
              >
                Không tìm thấy execution phù hợp.
              </TableCell>
            </TableRow>
          )}
          {executions.map((execution) => (
            <TableRow key={execution.id}>
              <TableCell>
                <Link
                  className="font-mono text-xs text-primary underline-offset-4 hover:underline"
                  to={`/admin/executions/${encodeURIComponent(execution.id)}${search}`}
                >
                  {execution.id}
                </Link>
              </TableCell>
              <TableCell>
                <p className="font-medium">{execution.workflowName}</p>
                <p className="text-xs text-muted-foreground">
                  Phiên bản {execution.versionNumber}
                </p>
              </TableCell>
              <TableCell>
                <p>{execution.ownerName}</p>
                <p className="text-xs text-muted-foreground">
                  {execution.ownerEmail}
                </p>
              </TableCell>
              <TableCell>{execution.triggerType}</TableCell>
              <TableCell>
                <ExecutionStatusBadge status={execution.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {executionTime(execution.queuedAt)}
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                {executionDuration(execution.durationMs)}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {execution.errorCode ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
