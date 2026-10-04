import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, RotateCcw, Clock, AlertCircle } from 'lucide-react';
import {
  useWorkflowVersions,
  useDraftStatus,
  useRestoreVersion,
} from '../hooks/useWorkflowVersions';
import { RestoreConflictDialog } from './RestoreConflictDialog';
import type {
  RestoreStrategy,
  WorkflowVersionSummary,
} from '../types/version.types';

interface VersionHistoryDialogProps {
  workflowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestoreSuccess: (definition: unknown) => void;
}

export const VersionHistoryDialog: React.FC<VersionHistoryDialogProps> = ({
  workflowId,
  open,
  onOpenChange,
  onRestoreSuccess,
}) => {
  const { data: versions, isLoading, isError, refetch } = useWorkflowVersions(workflowId);
  const { data: draftStatus } = useDraftStatus(workflowId);

  const [selectedVersion, setSelectedVersion] =
    useState<WorkflowVersionSummary | null>(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);

  const restoreMutation = useRestoreVersion(workflowId, {
    onSuccess: (data) => {
      setConflictDialogOpen(false);
      onOpenChange(false);
      onRestoreSuccess(data.definition);
      alert(`Khôi phục phiên bản v${data.restoredVersionNumber} thành công!`);
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message
          : 'Đã xảy ra lỗi khi khôi phục phiên bản';
      alert(`Lỗi khi khôi phục: ${message}`);
    },
  });

  const handleRestoreClick = (version: WorkflowVersionSummary) => {
    setSelectedVersion(version);

    // If draft has unpublished changes, open the conflict resolution modal
    if (draftStatus?.hasUnpublishedChanges) {
      setConflictDialogOpen(true);
    } else {
      // Seamless restore if draft is clean
      if (
        window.confirm(
          `Bạn có chắc chắn muốn khôi phục bản nháp về Phiên bản v${version.versionNumber}?`,
        )
      ) {
        restoreMutation.mutate({
          versionId: version.id,
          request: { strategy: 'OVERWRITE' },
        });
      }
    }
  };

  const handleConfirmConflict = async (strategy: RestoreStrategy) => {
    if (!selectedVersion) return;
    restoreMutation.mutate({
      versionId: selectedVersion.id,
      request: { strategy },
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <History className="size-5 text-primary" />
              <DialogTitle>Lịch sử phiên bản (Version History)</DialogTitle>
            </div>
            <DialogDescription>
              Xem các phiên bản đã xuất bản và khôi phục về bản nháp để chỉnh sửa.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[380px] overflow-y-auto py-2 pr-1">
            {isLoading && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Đang tải danh sách phiên bản...
              </div>
            )}

            {isError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>Không thể tải lịch sử phiên bản.</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  className="ml-auto"
                >
                  Thử lại
                </Button>
              </div>
            )}

            {!isLoading && (!versions || versions.length === 0) && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Chưa có phiên bản nào được xuất bản.
              </div>
            )}

            {!isLoading && versions && versions.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-semibold">
                          v{ver.versionNumber}
                        </Badge>
                        {draftStatus?.currentPublishedVersion?.id === ver.id && (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                            Đang hoạt động
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3.5" />
                        <span>
                          {new Date(ver.publishedAt).toLocaleString('vi-VN')}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreClick(ver)}
                      disabled={restoreMutation.isPending}
                      className="gap-1.5 text-xs"
                    >
                      <RotateCcw className="size-3.5" />
                      Khôi phục
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedVersion && (
        <RestoreConflictDialog
          open={conflictDialogOpen}
          onOpenChange={setConflictDialogOpen}
          targetVersionNumber={selectedVersion.versionNumber}
          onConfirm={handleConfirmConflict}
          loading={restoreMutation.isPending}
        />
      )}
    </>
  );
};
