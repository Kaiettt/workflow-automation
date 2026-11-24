import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useUsers } from "../../hooks/useAdmin";
import {
  executionStatuses,
  executionTriggerTypes,
  type AdminExecutionFilter,
} from "../../types/admin-execution.types";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
const uuidPattern =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
export function ExecutionFilterBar({
  filter,
  onChange,
  onIds,
}: {
  filter: AdminExecutionFilter;
  onChange: (name: string, value: string) => void;
  onIds: (workflowId: string, executionId: string) => void;
}) {
  const [ownerSearch, setOwnerSearch] = useState("");
  const owners = useUsers({
    page: 1,
    pageSize: 100,
    q: ownerSearch.trim() || undefined,
  });
  function applyIds(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const workflow = data.get("workflowId");
    const execution = data.get("executionId");
    onIds(
      typeof workflow === "string" ? workflow.trim() : "",
      typeof execution === "string" ? execution.trim() : "",
    );
  }
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="execution-owner-search">Tìm chủ sở hữu</Label>
          <Input
            id="execution-owner-search"
            maxLength={100}
            placeholder="Tên hoặc email…"
            value={ownerSearch}
            onChange={(event) => setOwnerSearch(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="execution-owner">Chủ sở hữu</Label>
          <select
            id="execution-owner"
            className={selectClass}
            value={filter.ownerId ?? ""}
            onChange={(event) => onChange("ownerId", event.target.value)}
          >
            <option value="">Tất cả chủ sở hữu</option>
            {filter.ownerId &&
              !owners.data?.items.some(
                (owner) => owner.id === filter.ownerId,
              ) && <option value={filter.ownerId}>{filter.ownerId}</option>}
            {owners.data?.items.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name} · {owner.email}
              </option>
            ))}
          </select>
          {owners.isError && (
            <p role="alert" className="text-xs text-destructive">
              Không thể tải chủ sở hữu. Hãy thử tìm lại.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="execution-status">Trạng thái</Label>
          <select
            id="execution-status"
            className={selectClass}
            value={filter.status ?? ""}
            onChange={(event) => onChange("status", event.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            {executionStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="execution-trigger">Trigger</Label>
          <select
            id="execution-trigger"
            className={selectClass}
            value={filter.triggerType ?? ""}
            onChange={(event) => onChange("triggerType", event.target.value)}
          >
            <option value="">Tất cả trigger</option>
            {executionTriggerTypes.map((trigger) => (
              <option key={trigger} value={trigger}>
                {trigger}
              </option>
            ))}
          </select>
        </div>
      </div>
      <form
        onSubmit={applyIds}
        className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]"
      >
        <div className="space-y-2">
          <Label htmlFor="execution-workflow-id">Workflow ID</Label>
          <Input
            key={filter.workflowId ?? ""}
            id="execution-workflow-id"
            name="workflowId"
            defaultValue={filter.workflowId ?? ""}
            pattern={uuidPattern}
            maxLength={36}
            title="Nhập UUID hợp lệ"
            placeholder="UUID workflow"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="execution-id-filter">Execution ID</Label>
          <Input
            key={filter.executionId ?? ""}
            id="execution-id-filter"
            name="executionId"
            defaultValue={filter.executionId ?? ""}
            pattern={uuidPattern}
            maxLength={36}
            title="Nhập UUID hợp lệ"
            placeholder="UUID execution"
          />
        </div>
        <Button type="submit" variant="outline">
          Áp dụng ID
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Các bộ lọc kết hợp với khoảng thời gian đã chọn, kể cả khi tìm theo
        execution ID.
      </p>
    </div>
  );
}
