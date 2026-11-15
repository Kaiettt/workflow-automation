import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import type { ConnectorAdminItem } from '../../types/admin.types';
import { useChangeConnectorPolicy } from '../../hooks/useAdminConnectors';

interface ConnectorPolicyDialogProps {
  connector: ConnectorAdminItem | null;
  open: boolean;
  onClose: () => void;
}

export function ConnectorPolicyDialog({
  connector,
  open,
  onClose,
}: ConnectorPolicyDialogProps) {
  const [allowNewCredentials, setAllowNewCredentials] = useState(
    connector?.allowNewCredentials ?? true,
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [prevConnectorId, setPrevConnectorId] = useState<string | null>(connector?.id ?? null);

  if (connector && connector.id !== prevConnectorId) {
    setPrevConnectorId(connector.id);
    setAllowNewCredentials(connector.allowNewCredentials);
    setReason('');
    setError(null);
  }

  const mutation = useChangeConnectorPolicy();

  if (!connector) return null;

  const trimmedReason = reason.trim();
  const isValid =
    trimmedReason.length >= 5 &&
    trimmedReason.length <= 500 &&
    allowNewCredentials !== connector.allowNewCredentials;

  const handleConfirm = async () => {
    setError(null);
    try {
      await mutation.mutateAsync({
        id: connector.id,
        payload: {
          allowNewCredentials,
          reason: trimmedReason,
          expectedRevision: connector.revision,
        },
      });
      onClose();
    } catch (err: unknown) {
      const errObj = err as {
        response?: { data?: { code?: string; message?: string } };
        code?: string;
        message?: string;
      };
      const code = errObj?.response?.data?.code || errObj?.code;
      if (code === 'STALE_REVISION') {
        setError(
          'Chính sách đã bị thay đổi bởi quản trị viên khác. Vui lòng tải lại trang.',
        );
      } else {
        setError(
          errObj?.response?.data?.message ||
            errObj?.message ||
            'Không thể cập nhật chính sách',
        );
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Điều chỉnh chính sách kết nối</DialogTitle>
          <DialogDescription>
            Cập nhật chính sách cấp mới credential cho connector{' '}
            <strong className="text-foreground">{connector.name}</strong> (
            {connector.key}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between rounded-lg border p-3 shadow-xs">
            <div className="space-y-0.5">
              <Label
                htmlFor="allow-credentials-switch"
                className="text-sm font-medium"
              >
                Cho phép tạo credential mới
              </Label>
              <p className="text-xs text-muted-foreground">
                {allowNewCredentials
                  ? 'Người dùng có thể tạo kết nối mới bình thường.'
                  : 'Tạm ngưng cấp mới. Các credential cũ vẫn hoạt động 100%.'}
              </p>
            </div>
            <Switch
              id="allow-credentials-switch"
              checked={allowNewCredentials}
              onCheckedChange={setAllowNewCredentials}
              disabled={mutation.isPending}
            />
          </div>

          {!allowNewCredentials && (
            <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-xs">
                Vô hiệu hóa chỉ ngăn người dùng tạo kết nối mới. Các kết nối và
                workflow hiện hữu tiếp tục hoạt động bình thường và refresh
                token tự động.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="policy-reason">Lý do thay đổi (5–500 ký tự)</Label>
            <Textarea
              id="policy-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do thay đổi chính sách kết nối..."
              maxLength={500}
              rows={3}
              disabled={mutation.isPending}
              className="resize-none"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Bắt buộc ghi nhận cho audit trail.</span>
              <span className="tabular-nums">{trimmedReason.length}/500</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button
            disabled={!isValid || mutation.isPending}
            onClick={handleConfirm}
          >
            {mutation.isPending ? 'Đang lưu…' : 'Xác nhận thay đổi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

