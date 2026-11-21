import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NodeIcon } from "@/components/shared/NodeIcon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { NodeTypeAdminItem } from "../../types/admin.types";

export function NodeTypeTable({
  nodes,
  pending,
  onStatus,
  onDetail,
}: {
  nodes: NodeTypeAdminItem[];
  pending: boolean;
  onStatus: (node: NodeTypeAdminItem) => void;
  onDetail: (key: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Loại node</TableHead>
            <TableHead>Danh mục</TableHead>
            <TableHead>Connector</TableHead>
            <TableHead>Bảng chọn</TableHead>
            <TableHead>Thực thi</TableHead>
            <TableHead>Đã phát hành</TableHead>
            <TableHead>Nháp</TableHead>
            <TableHead>Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!nodes.length && (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-12 text-center text-muted-foreground"
              >
                Không tìm thấy loại node phù hợp.
              </TableCell>
            </TableRow>
          )}
          {nodes.map((node) => (
            <TableRow key={node.key}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <NodeIcon
                    icon={node.icon}
                    name={node.displayName}
                    color={node.color ?? undefined}
                  />
                  <div>
                    <p className="font-medium">{node.displayName}</p>
                    <p className="text-xs text-muted-foreground">{node.key}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{node.category}</Badge>
              </TableCell>
              <TableCell>{node.connectorName ?? "—"}</TableCell>
              <TableCell>
                <Badge
                  variant={node.isCatalogVisible ? "secondary" : "outline"}
                >
                  {node.isCatalogVisible ? "Hiển thị" : "Đã ẩn"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    node.isExecutionAllowed ? "secondary" : "destructive"
                  }
                >
                  {node.isExecutionAllowed ? "Cho phép" : "Đã chặn"}
                </Badge>
              </TableCell>
              <TableCell className="tabular-nums">
                {node.publishedWorkflowCount}
              </TableCell>
              <TableCell className="tabular-nums">
                {node.draftWorkflowCount}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDetail(node.key)}
                    aria-label={`Chi tiết ${node.displayName}`}
                  >
                    Chi tiết
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => onStatus(node)}
                    aria-label={`Điều chỉnh ${node.displayName}`}
                  >
                    Điều chỉnh
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
