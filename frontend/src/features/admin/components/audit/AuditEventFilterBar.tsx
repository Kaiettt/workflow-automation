import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useUsers } from "../../hooks/useAdmin";
import {
  auditActions,
  auditActorTypes,
  auditTargetTypes,
  type AdminAuditFilter,
} from "../../types/admin-audit.types";
import { auditActionLabels } from "../../utils/audit-view";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
const uuidPattern =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
export function AuditEventFilterBar({
  filter,
  onChange,
  onIds,
}: {
  filter: AdminAuditFilter;
  onChange: (name: string, value: string) => void;
  onIds: (actorId: string, targetId: string) => void;
}) {
  const [actorSearch, setActorSearch] = useState("");
  const actors = useUsers({
    page: 1,
    pageSize: 100,
    q: actorSearch.trim() || undefined,
  });
  function applyIds(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const actor = data.get("actorId");
    const target = data.get("targetId");
    onIds(
      typeof actor === "string" ? actor.trim() : "",
      typeof target === "string" ? target.trim() : "",
    );
  }
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="audit-action">Hành động</Label>
          <select
            id="audit-action"
            className={selectClass}
            value={filter.action ?? ""}
            onChange={(event) => onChange("action", event.target.value)}
          >
            <option value="">Tất cả hành động</option>
            {auditActions.map((action) => (
              <option key={action} value={action}>
                {auditActionLabels[action]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-target-type">Loại tài nguyên</Label>
          <select
            id="audit-target-type"
            className={selectClass}
            value={filter.targetType ?? ""}
            onChange={(event) => onChange("targetType", event.target.value)}
          >
            <option value="">Tất cả tài nguyên</option>
            {auditTargetTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-actor-type">Loại người thực hiện</Label>
          <select
            id="audit-actor-type"
            className={selectClass}
            value={filter.actorType ?? ""}
            onChange={(event) => onChange("actorType", event.target.value)}
          >
            <option value="">Tất cả</option>
            {auditActorTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-actor-search">Tìm người thực hiện</Label>
          <Input
            id="audit-actor-search"
            maxLength={100}
            placeholder="Tên hoặc email…"
            value={actorSearch}
            onChange={(event) => setActorSearch(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-actor">Người thực hiện</Label>
          <select
            id="audit-actor"
            className={selectClass}
            value={filter.actorId ?? ""}
            onChange={(event) => onChange("actorId", event.target.value)}
          >
            <option value="">Tất cả người thực hiện</option>
            {filter.actorId &&
              !actors.data?.items.some(
                (actor) => actor.id === filter.actorId,
              ) && <option value={filter.actorId}>{filter.actorId}</option>}
            {actors.data?.items.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name} · {actor.email}
              </option>
            ))}
          </select>
          {actors.isError && (
            <p role="alert" className="text-xs text-destructive">
              Không thể tải người thực hiện. Hãy thử tìm lại.
            </p>
          )}
        </div>
      </div>
      <form
        onSubmit={applyIds}
        className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]"
      >
        <div className="space-y-2">
          <Label htmlFor="audit-actor-id">Actor ID</Label>
          <Input
            key={filter.actorId ?? ""}
            id="audit-actor-id"
            name="actorId"
            defaultValue={filter.actorId ?? ""}
            pattern={uuidPattern}
            maxLength={36}
            title="Nhập UUID hợp lệ"
            placeholder="UUID người thực hiện"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-target-id">Target ID</Label>
          <Input
            key={filter.targetId ?? ""}
            id="audit-target-id"
            name="targetId"
            defaultValue={filter.targetId ?? ""}
            pattern={uuidPattern}
            maxLength={36}
            title="Nhập UUID hợp lệ"
            placeholder="UUID tài nguyên"
          />
        </div>
        <Button type="submit" variant="outline">
          Áp dụng ID
        </Button>
      </form>
    </div>
  );
}
