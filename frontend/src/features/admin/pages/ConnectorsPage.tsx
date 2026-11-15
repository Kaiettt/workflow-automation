import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { PageControls } from '../components/PageControls';
import { ConnectorTable } from '../components/connectors/ConnectorTable';
import { ConnectorPolicyDialog } from '../components/connectors/ConnectorPolicyDialog';
import { useAdminConnectors } from '../hooks/useAdminConnectors';
import type {
  ConnectorAdminItem,
  ConnectorAuthType,
} from '../types/admin.types';

export function ConnectorsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [authType, setAuthType] = useState<string>('ALL');
  const [policyFilter, setPolicyFilter] = useState<string>('ALL');

  const [selectedConnector, setSelectedConnector] =
    useState<ConnectorAdminItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const queryFilter = {
    page,
    pageSize,
    q: searchTerm.trim() || undefined,
    authType:
      authType !== 'ALL' ? (authType as ConnectorAuthType) : undefined,
    allowNewCredentials:
      policyFilter === 'ALLOWED'
        ? true
        : policyFilter === 'DISABLED'
          ? false
          : undefined,
  };

  const { data, isLoading, error } = useAdminConnectors(queryFilter);

  const handleOpenPolicy = (connector: ConnectorAdminItem) => {
    setSelectedConnector(connector);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Quản lý Connector"
        description="Theo dõi danh mục kết nối bên thứ ba, thống kê mức độ sử dụng và điều phối chính sách cấp mới credential."
        eyebrow="Tích hợp & Kết nối"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên hoặc key..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={authType}
            onValueChange={(val) => {
              if (val !== null) {
                setAuthType(val);
                setPage(1);
              }
            }}
          >
            <SelectTrigger className="w-[140px] text-xs">
              <SelectValue placeholder="Auth Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả Auth</SelectItem>
              <SelectItem value="OAUTH2">OAuth2</SelectItem>
              <SelectItem value="API_KEY">API Key</SelectItem>
              <SelectItem value="BASIC">Basic</SelectItem>
              <SelectItem value="NONE">None</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={policyFilter}
            onValueChange={(val) => {
              if (val !== null) {
                setPolicyFilter(val);
                setPage(1);
              }
            }}
          >
            <SelectTrigger className="w-[160px] text-xs">
              <SelectValue placeholder="Chính sách" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả chính sách</SelectItem>
              <SelectItem value="ALLOWED">Cho phép tạo mới</SelectItem>
              <SelectItem value="DISABLED">Tạm ngưng cấp mới</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center rounded-md border text-sm text-muted-foreground">
          Đang tải danh sách connector…
        </div>
      ) : error ? (
        <div className="flex h-48 items-center justify-center rounded-md border text-sm text-destructive">
          Không thể tải danh sách connector. Vui lòng thử lại.
        </div>
      ) : (
        <div className="space-y-2">
          <ConnectorTable
            connectors={data?.items || []}
            onOpenPolicy={handleOpenPolicy}
          />
          {data && data.total > 0 && (
            <PageControls
              page={page}
              total={data.total}
              pageSize={pageSize}
              onChange={setPage}
            />
          )}
        </div>
      )}

      <ConnectorPolicyDialog
        connector={selectedConnector}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}

