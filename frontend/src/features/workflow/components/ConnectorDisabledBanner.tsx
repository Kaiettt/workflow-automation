import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

interface ConnectorDisabledBannerProps {
  connectorName?: string;
}

export function ConnectorDisabledBanner({
  connectorName,
}: ConnectorDisabledBannerProps) {
  return (
    <Alert
      role="status"
      className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200 my-2"
    >
      <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-xs font-semibold">
        Tạm ngưng cấp kết nối mới
      </AlertTitle>
      <AlertDescription className="text-xs">
        Quản trị viên hệ thống đã tạm dừng cấp kết nối mới cho dịch vụ{' '}
        {connectorName ? <strong>{connectorName}</strong> : 'này'}. Các kết nối
        đã tạo trước đó vẫn tiếp tục hoạt động bình thường.
      </AlertDescription>
    </Alert>
  );
}

