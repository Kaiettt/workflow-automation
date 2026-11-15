import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Settings2, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { ConnectorAdminItem } from '../../types/admin.types';

interface ConnectorTableProps {
  connectors: ConnectorAdminItem[];
  onOpenPolicy: (connector: ConnectorAdminItem) => void;
}

export function ConnectorTable({
  connectors,
  onOpenPolicy,
}: ConnectorTableProps) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Connector</TableHead>
            <TableHead>Xác thực (AuthType)</TableHead>
            <TableHead>Trạng thái Catalog</TableHead>
            <TableHead>Chính sách Cấp mới</TableHead>
            <TableHead className="text-right">Credentials</TableHead>
            <TableHead className="text-right">Workflows Đã Xuất Bản</TableHead>
            <TableHead className="text-center">Hành động</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {connectors.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-24 text-center text-muted-foreground"
              >
                Không tìm thấy connector nào thỏa điều kiện lọc.
              </TableCell>
            </TableRow>
          ) : (
            connectors.map((connector) => (
              <TableRow key={connector.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">
                      {connector.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {connector.key}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs font-mono">
                    {connector.authType}
                  </Badge>
                </TableCell>
                <TableCell>
                  {connector.isActive ? (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                    >
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inactive
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {connector.allowNewCredentials ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      <span>Cho phép tạo mới</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      <span>Tạm ngưng cấp mới</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {connector.credentialCount}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {connector.workflowCount}
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => onOpenPolicy(connector)}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    <span>Chính sách</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

