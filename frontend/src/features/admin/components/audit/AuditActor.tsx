import { Badge } from "@/components/ui/badge";
import type { AdminAuditSummary } from "../../types/admin-audit.types";

export function AuditActor({
  event,
}: {
  event: Pick<
    AdminAuditSummary,
    "actorType" | "actorId" | "actorName" | "actorEmail"
  >;
}) {
  if (event.actorType === "SYSTEM")
    return <Badge variant="outline">SYSTEM</Badge>;
  return (
    <div>
      <p>{event.actorName ?? event.actorId ?? "Không xác định"}</p>
      {event.actorEmail && (
        <p className="text-xs text-muted-foreground">{event.actorEmail}</p>
      )}
    </div>
  );
}
