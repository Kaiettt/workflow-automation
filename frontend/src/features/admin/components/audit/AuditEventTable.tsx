import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminAuditSummary } from "../../types/admin-audit.types";
import { auditActionLabels, auditLocalTime } from "../../utils/audit-view";
import { AuditActor } from "./AuditActor";

export function AuditEventTable({
  events,
  onDetail,
}: {
  events: AdminAuditSummary[];
  onDetail: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {[
              "Thời điểm",
              "Người thực hiện",
              "Hành động",
              "Tài nguyên",
              "Lý do",
              "Chi tiết",
            ].map((label) => (
              <TableHead key={label}>{label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {!events.length && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-12 text-center text-muted-foreground"
              >
                Không tìm thấy sự kiện quản trị phù hợp.
              </TableCell>
            </TableRow>
          )}
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell className="whitespace-nowrap">
                <p>{auditLocalTime(event.createdAt)}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  UTC: {event.createdAt}
                </p>
              </TableCell>
              <TableCell>
                <AuditActor event={event} />
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {auditActionLabels[event.action]}
                </Badge>
              </TableCell>
              <TableCell>
                <p>{event.targetName ?? event.targetType}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {event.targetId}
                </p>
              </TableCell>
              <TableCell className="max-w-64">
                <p className="line-clamp-2">{event.reason}</p>
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={"Chi tiết " + event.id}
                  onClick={() => onDetail(event.id)}
                >
                  Xem chi tiết
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
