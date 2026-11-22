import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { PageControls } from "../components/PageControls";
import { QueryFeedback } from "../components/QueryFeedback";
import { NodeTypeTable } from "../components/node-types/NodeTypeTable";
import { NodeTypeStatusDialog } from "../components/node-types/NodeTypeStatusDialog";
import { NodeTypeDetailCard } from "../components/node-types/NodeTypeDetailCard";
import { useAdminNodeTypes } from "../hooks/useAdminNodeTypes";
import { useAdminConnectors } from "../hooks/useAdminConnectors";
import type {
  NodeTypeAdminItem,
  NodeTypeCategory,
  NodeTypeFilter,
} from "../types/admin.types";

const categories: readonly NodeTypeCategory[] = [
  "TRIGGER",
  "LOGIC",
  "DATA_PROCESSING",
  "INTEGRATION",
  "AI",
];
const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm";
function booleanFilter(value: string | null) {
  return value === "true" ? true : value === "false" ? false : undefined;
}

export function NodeTypesPage() {
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<NodeTypeAdminItem | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [connectorSearch, setConnectorSearch] = useState("");
  const requestedPage = Number(params.get("page") ?? 1);
  const filter: NodeTypeFilter = {
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
    pageSize:
      params.get("pageSize") === "100"
        ? 100
        : params.get("pageSize") === "50"
          ? 50
          : 20,
    q: params.get("q")?.trim() || undefined,
    category: categories.find(
      (category) => category === params.get("category"),
    ),
    connectorId: params.get("connectorId") || undefined,
    isCatalogVisible: booleanFilter(params.get("isCatalogVisible")),
    isExecutionAllowed: booleanFilter(params.get("isExecutionAllowed")),
    sortBy: params.get("sortBy") === "updatedAt" ? "updatedAt" : "displayName",
    sortOrder: params.get("sortOrder") === "desc" ? "desc" : "asc",
  };
  const query = useAdminNodeTypes(filter);
  const connectors = useAdminConnectors({
    page: 1,
    pageSize: 100,
    q: connectorSearch.trim() || undefined,
  });
  const update = (name: string, value: string) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(name, value);
        else next.delete(name);
        if (name !== "page") next.delete("page");
        return next;
      },
      { replace: true },
    );
  };
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Quản lý loại node"
        description="Theo dõi mức sử dụng, hiển thị trong bảng chọn và quyền thực thi của từng loại node."
        eyebrow="Danh mục & Chính sách"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="node-search">Tìm loại node</Label>
          <Input
            id="node-search"
            maxLength={100}
            placeholder="Tên hoặc key…"
            value={params.get("q") ?? ""}
            onChange={(event) => update("q", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="node-category">Danh mục</Label>
          <select
            id="node-category"
            className={selectClass + " w-full"}
            value={filter.category ?? ""}
            onChange={(event) => update("category", event.target.value)}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="node-visibility">Hiển thị trên bảng chọn</Label>
          <select
            id="node-visibility"
            className={selectClass + " w-full"}
            value={params.get("isCatalogVisible") ?? ""}
            onChange={(event) => update("isCatalogVisible", event.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="true">Hiển thị</option>
            <option value="false">Đã ẩn</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="node-execution">Quyền thực thi</Label>
          <select
            id="node-execution"
            className={selectClass + " w-full"}
            value={params.get("isExecutionAllowed") ?? ""}
            onChange={(event) =>
              update("isExecutionAllowed", event.target.value)
            }
          >
            <option value="">Tất cả</option>
            <option value="true">Cho phép</option>
            <option value="false">Đã chặn</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="connector-search">Tìm connector</Label>
          <Input
            id="connector-search"
            maxLength={100}
            value={connectorSearch}
            onChange={(event) => setConnectorSearch(event.target.value)}
            placeholder="Tìm kết nối để lọc…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="node-connector">Connector</Label>
          <select
            id="node-connector"
            className={selectClass + " w-full"}
            value={filter.connectorId ?? ""}
            onChange={(event) => update("connectorId", event.target.value)}
          >
            <option value="">Tất cả connector</option>
            {filter.connectorId &&
              !connectors.data?.items.some(
                (connector) => connector.id === filter.connectorId,
              ) && (
                <option value={filter.connectorId}>Connector đã chọn</option>
              )}
            {connectors.data?.items.map((connector) => (
              <option key={connector.id} value={connector.id}>
                {connector.name}
              </option>
            ))}
          </select>
          {connectors.isError && (
            <p role="alert" className="text-xs text-destructive">
              Không thể tải connector. Hãy thử tìm lại.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="node-sort">Sắp xếp theo</Label>
          <select
            id="node-sort"
            className={selectClass + " w-full"}
            value={filter.sortBy}
            onChange={(event) => update("sortBy", event.target.value)}
          >
            <option value="displayName">Tên hiển thị</option>
            <option value="updatedAt">Cập nhật gần nhất</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="node-order">Thứ tự</Label>
          <select
            id="node-order"
            className={selectClass + " w-full"}
            value={filter.sortOrder}
            onChange={(event) => update("sortOrder", event.target.value)}
          >
            <option value="asc">Tăng dần</option>
            <option value="desc">Giảm dần</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Số workflow nháp chỉ tính workflow ở trạng thái DRAFT. Số đã phát hành
        chỉ tính phiên bản hiện hành.
      </p>
      <QueryFeedback
        pending={query.isLoading}
        error={query.isError}
        loadingText="Đang tải loại node…"
        errorText="Không thể tải danh mục loại node."
        onRetry={() => {
          void query.refetch();
        }}
      />
      {query.data && !query.isError && (
        <div aria-busy={query.isFetching}>
          <NodeTypeTable
            nodes={query.data.items}
            pending={query.isPlaceholderData}
            onStatus={setSelected}
            onDetail={setDetail}
          />
          <PageControls
            page={filter.page}
            pageSize={filter.pageSize}
            total={query.data.total}
            onChange={(page) => update("page", String(page))}
          />
          <div className="mt-3 flex items-center gap-2">
            <Label htmlFor="node-page-size">Số dòng mỗi trang</Label>
            <select
              id="node-page-size"
              className={selectClass}
              value={filter.pageSize}
              onChange={(event) => update("pageSize", event.target.value)}
            >
              {[20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {selected && (
        <NodeTypeStatusDialog
          key={selected.key}
          nodeType={selected}
          onClose={() => setSelected(null)}
        />
      )}
      {detail && (
        <NodeTypeDetailCard nodeKey={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}
