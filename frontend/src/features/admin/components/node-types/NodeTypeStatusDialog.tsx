import { useState } from "react";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminNodeType,
  useChangeNodeTypeStatus,
} from "../../hooks/useAdminNodeTypes";
import type { NodeTypeAdminItem } from "../../types/admin.types";

export function NodeTypeStatusDialog({
  nodeType,
  onClose,
}: {
  nodeType: NodeTypeAdminItem;
  onClose: () => void;
}) {
  const [snapshot, setSnapshot] = useState(nodeType);
  const [visible, setVisible] = useState(nodeType.isCatalogVisible);
  const [allowed, setAllowed] = useState(nodeType.isExecutionAllowed);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const latest = useAdminNodeType(nodeType.key, false);
  const mutation = useChangeNodeTypeStatus();
  const busy = mutation.isPending || latest.isFetching;
  const trimmed = reason.trim();
  const changed =
    visible !== snapshot.isCatalogVisible ||
    allowed !== snapshot.isExecutionAllowed;
  const valid =
    changed && trimmed.length >= 5 && trimmed.length <= 500 && !stale;

  const submit = async () => {
    if (!valid || busy) return;
    setError(null);
    try {
      await mutation.mutateAsync({
        key: nodeType.key,
        payload: {
          isCatalogVisible: visible,
          isExecutionAllowed: allowed,
          reason: trimmed,
          expectedRevision: snapshot.revision,
        },
      });
      onClose();
    } catch (failure: unknown) {
      const payload: unknown = isAxiosError(failure)
        ? failure.response?.data
        : failure;
      const conflict =
        typeof payload === "object" &&
        payload !== null &&
        "code" in payload &&
        payload.code === "STALE_REVISION";
      setStale(conflict);
      setError(
        conflict
          ? "Chính sách đã được Admin khác thay đổi. Tải lại chính sách trước khi thử lại."
          : "Không thể lưu thay đổi. Vui lòng thử lại.",
      );
    }
  };
  const reload = async () => {
    const result = await latest.refetch();
    if (result.data && !result.error) {
      setSnapshot(result.data);
      setVisible(result.data.isCatalogVisible);
      setAllowed(result.data.isExecutionAllowed);
      setStale(false);
      setError(null);
    } else setError("Không thể tải lại chính sách. Vui lòng thử lại.");
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Điều chỉnh trạng thái loại node</DialogTitle>
          <DialogDescription>
            {nodeType.displayName} · {nodeType.key}. Có{" "}
            {snapshot.publishedWorkflowCount} workflow đã phát hành và{" "}
            {snapshot.draftWorkflowCount} workflow nháp sử dụng.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          {error && (
            <div role="alert" className="space-y-2 text-sm text-destructive">
              <p>{error}</p>
              {stale && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    void reload();
                  }}
                >
                  Tải lại chính sách
                </Button>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="node-visible">Hiển thị trên bảng chọn</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Ẩn node vẫn giữ cấu hình của workflow hiện có.
              </p>
            </div>
            <Switch
              id="node-visible"
              checked={visible}
              onCheckedChange={setVisible}
              disabled={busy}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="node-allowed">Cho phép thực thi</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Kiểm soát quyền chạy node trong mọi workflow.
              </p>
            </div>
            <Switch
              id="node-allowed"
              checked={allowed}
              onCheckedChange={setAllowed}
              disabled={busy}
            />
          </div>
          {!allowed && (
            <p
              role="status"
              className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
            >
              Các workflow sẽ dừng lỗi khi bắt đầu chạy node này. Tác vụ đã bắt
              đầu sẽ không bị hủy.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="node-policy-reason">
              Lý do thay đổi (5–500 ký tự)
            </Label>
            <Textarea
              id="node-policy-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              rows={3}
              disabled={busy}
              required
              aria-describedby="node-reason-hint"
            />
            <p id="node-reason-hint" className="text-xs text-muted-foreground">
              {trimmed.length}/500 ký tự · Lý do được ghi vào nhật ký quản trị.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={!valid || busy}>
              {busy ? "Đang lưu…" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
