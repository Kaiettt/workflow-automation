import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ShieldCheck, Copy, Trash2 } from 'lucide-react';
import type { RestoreStrategy } from '../types/version.types';

interface RestoreConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetVersionNumber: number;
  onConfirm: (strategy: RestoreStrategy) => Promise<void>;
  loading?: boolean;
}

export const RestoreConflictDialog: React.FC<RestoreConflictDialogProps> = ({
  open,
  onOpenChange,
  targetVersionNumber,
  onConfirm,
  loading = false,
}) => {
  const [selectedStrategy, setSelectedStrategy] =
    useState<RestoreStrategy>('PUBLISH_THEN_RESTORE');

  const handleConfirm = async () => {
    await onConfirm(selectedStrategy);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-lg font-semibold">
              Khôi phục Phiên bản v{targetVersionNumber}
            </DialogTitle>
            <Badge variant="outline">Cảnh báo</Badge>
          </div>
          <DialogDescription>
            Bản nháp hiện tại của bạn đang có những thay đổi chưa được xuất bản.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="font-medium">Phát hiện bản nháp chưa xuất bản</AlertTitle>
          <AlertDescription className="text-xs">
            Việc khôi phục phiên bản <strong>v{targetVersionNumber}</strong> sẽ ghi đè lên bản nháp đang chỉnh sửa. Vui lòng chọn cách xử lý bên dưới để tránh mất dữ liệu:
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-3 py-2">
          {/* Option 1: PUBLISH_THEN_RESTORE */}
          <div
            onClick={() => setSelectedStrategy('PUBLISH_THEN_RESTORE')}
            className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
              selectedStrategy === 'PUBLISH_THEN_RESTORE'
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border hover:bg-muted/50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Xuất bản bản nháp trước</span>
                  <Badge variant="secondary" className="text-[10px]">
                    Khuyến nghị - An toàn nhất
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Lưu các thay đổi dở dang thành một phiên bản snapshot mới trong lịch sử, sau đó nạp phiên bản v{targetVersionNumber} vào bản nháp. Bạn có thể quay lại bất cứ lúc nào.
                </p>
              </div>
            </div>
          </div>

          {/* Option 2: BACKUP_THEN_RESTORE */}
          <div
            onClick={() => setSelectedStrategy('BACKUP_THEN_RESTORE')}
            className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
              selectedStrategy === 'BACKUP_THEN_RESTORE'
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border hover:bg-muted/50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-blue-500/10 p-1.5 text-blue-600 dark:text-blue-400">
                <Copy className="size-4" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium">Tách thành Workflow mới (Backup)</span>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tạo một workflow bản sao độc lập để lưu giữ ý tưởng đang làm dở, sau đó khôi phục v{targetVersionNumber} tại workflow này.
                </p>
              </div>
            </div>
          </div>

          {/* Option 3: OVERWRITE */}
          <div
            onClick={() => setSelectedStrategy('OVERWRITE')}
            className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
              selectedStrategy === 'OVERWRITE'
                ? 'border-destructive bg-destructive/5 ring-2 ring-destructive/20'
                : 'border-border hover:bg-muted/50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-destructive/10 p-1.5 text-destructive">
                <Trash2 className="size-4" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-destructive">Hủy bỏ thay đổi & Ghi đè trực tiếp</span>
                <p className="mt-1 text-xs text-muted-foreground">
                  Xóa bỏ toàn bộ các thay đổi chưa xuất bản và nạp trực tiếp v{targetVersionNumber}. <em>Không thể hoàn tác sau khi ghi đè.</em>
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            variant={selectedStrategy === 'OVERWRITE' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Đang khôi phục...' : 'Xác nhận khôi phục'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
