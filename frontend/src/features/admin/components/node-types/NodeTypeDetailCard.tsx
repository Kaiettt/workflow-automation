import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QueryFeedback } from "../QueryFeedback";
import { useAdminNodeType } from "../../hooks/useAdminNodeTypes";

export function NodeTypeDetailCard({
  nodeKey,
  onClose,
}: {
  nodeKey: string;
  onClose: () => void;
}) {
  const query = useAdminNodeType(nodeKey);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {query.data?.displayName ?? "Chi tiết loại node"}
          </DialogTitle>
          <DialogDescription>{nodeKey}</DialogDescription>
        </DialogHeader>
        <QueryFeedback
          pending={query.isLoading}
          error={query.isError}
          loadingText="Đang tải chi tiết…"
          errorText="Không thể tải thông tin loại node."
          onRetry={() => {
            void query.refetch();
          }}
        />
        {query.data && !query.isError && (
          <div className="space-y-5">
            <p className="text-sm">
              {query.data.publishedWorkflowCount} workflow đã phát hành ·{" "}
              {query.data.draftWorkflowCount} workflow nháp
            </p>
            <section className="space-y-2">
              <h2 className="font-semibold">Workflow đang sử dụng</h2>
              <p className="text-xs text-muted-foreground">
                Tối đa 10 workflow cập nhật gần nhất. Không bao gồm phiên bản
                lịch sử và workflow đã lưu trữ.
              </p>
              {query.data.workflows.length ? (
                <ul className="space-y-2">
                  {query.data.workflows.map((workflow) => (
                    <li
                      key={workflow.id}
                      className="rounded-md border p-3 text-sm"
                    >
                      <p className="font-medium">{workflow.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {workflow.ownerEmail} · {workflow.status}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Chưa có workflow sử dụng.
                </p>
              )}
            </section>
            {[
              ["Cấu hình", query.data.configSchema],
              ["Đầu vào", query.data.inputSchema],
              ["Đầu ra", query.data.outputSchema],
            ].map(([label, schema]) => (
              <details key={String(label)} className="rounded-md border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Schema {String(label)}
                </summary>
                <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(schema, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        )}
        <Button variant="outline" onClick={onClose}>
          Đóng
        </Button>
      </DialogContent>
    </Dialog>
  );
}
