# Thiết kế: Quản lý Loại Node (Node Type Management)

Status: ready-for-agent (P1)

## 1. Ranh giới Module và Phân tầng Kiến trúc

- **Presentation**: `monolith-backend/libs/admin/src/presentation`:
  - `GET /api/admin/node-types` -> `AdminReadQuery({ kind: 'nodeTypes', filter })`
  - `GET /api/admin/node-types/:key` -> `AdminReadQuery({ kind: 'nodeType', key })`
  - `PATCH /api/admin/node-types/:key/status` -> `@AdminBodyFields('isCatalogVisible', 'isExecutionAllowed')` -> `ChangeNodeTypeStatusCommand`
- **Domain & Application**:
  - `libs/node-library/src/application/ports/node-type-policy.port.ts`: Interface quản lý chính sách node type.
  - `libs/node-library/src/application/commands/change-node-type-status.command.ts`: Command handler thực thi cập nhật trạng thái trong transaction có advisory lock.
- **Infrastructure & Persistence**:
  - `monolith-backend/prisma/schema.prisma`:
    ```prisma
    model NodeTypePolicy {
      nodeTypeKey        String             @id @map("node_type_key") @db.VarChar(150)
      nodeType           NodeTypeDefinition @relation(fields: [nodeTypeKey], references: [key], onDelete: Cascade)
      isCatalogVisible   Boolean            @default(true) @map("is_catalog_visible")
      isExecutionAllowed Boolean            @default(true) @map("is_execution_allowed")
      revision           Int                @default(0)
      updatedAt          DateTime           @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

      @@map("node_type_policies")
    }
    ```
  - `PackageCatalogSync`: Bỏ qua bảng `node_type_policies`.

## 2. Hợp đồng API và DTO Whitelist

### DTO Thay đổi Trạng thái
```typescript
export class ChangeNodeTypeStatusDto {
  @IsOptional()
  @IsBoolean()
  isCatalogVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  isExecutionAllowed?: boolean;

  @IsString()
  @Length(5, 500)
  reason!: string;

  @IsInt()
  @Min(0)
  expectedRevision!: number;
}
```

### Response Projection DTO
```typescript
export interface NodeTypeAdminSummaryDto {
  id: string;
  key: string;
  displayName: string;
  icon?: string;
  color?: string;
  category: 'TRIGGER' | 'ACTION' | 'LOGIC' | 'TRANSFORMATION' | 'INTEGRATION';
  connectorKey?: string;
  connectorName?: string;
  isCatalogVisible: boolean;
  isExecutionAllowed: boolean;
  revision: number;
  publishedWorkflowCount: number;
  draftWorkflowCount: number;
  createdAt: string;
  updatedAt: string;
}
```

## 3. Thiết kế Transaction và Thực thi Runtime Gates

### 3.1. Advisory Lock Quản lý Node Type
Mọi thao tác đổi trạng thái node type sử dụng advisory lock:
`SELECT pg_advisory_xact_lock(7261103);`

### 3.2. Palette Filter Gate (`NodeTypesController`)
Trong `libs/node-library/src/presentation/http/node-types.controller.ts`:
```typescript
@Get()
async getNodeTypes() {
  // Query kết hợp NodeTypeDefinition với NodeTypePolicy
  // Lọc chỉ trả về các node có policy.isCatalogVisible !== false
  return this.queryBus.execute(new GetNodeTypesQuery({ catalogVisibleOnly: true }));
}
```

### 3.3. Runtime Execution Enforcement Gate (`NodeRunner`)
Trong `libs/execution/src/application/services/node-runner.ts`:
```typescript
async run(params: NodeRunParams): Promise<NodeRunResult> {
  const { node } = params;
  const nodeKey = node.data?.key;

  // 1. Kiểm tra chính sách cho phép thực thi
  const isAllowed = await this.nodeTypePolicyPort.isExecutionAllowed(nodeKey);
  if (!isAllowed) {
    const startedAt = new Date();
    const finishedAt = new Date();
    await this.observer.notifyStarted(params, startedAt);
    return this.observer.notifyFailed(
      params,
      new Error(`Node type ${nodeKey} has been disabled by platform administrator`),
      startedAt,
      finishedAt,
      'NODE_TYPE_DISABLED',
    );
  }

  // 2. Tiếp tục thực thi bình thường qua Executor Strategy
  ...
}
```

## 4. Thiết kế Giao diện Frontend

- `NodeTypesPage.tsx`:
  - Thanh tìm kiếm theo key hoặc tên hiển thị.
  - Dropdown lọc danh mục (`TRIGGER`, `ACTION`, `LOGIC`, `TRANSFORMATION`, `INTEGRATION`).
  - Dropdown lọc `isCatalogVisible` và `isExecutionAllowed`.
  - Bảng danh mục node: Icon, Tên, Key, Badge Category, Switch trực tiếp hoặc nút bấm "Điều chỉnh trạng thái", số workflow published, số workflow draft.
- `NodeTypeStatusDialog.tsx`:
  - Switch `Hiển thị trên Palette (Catalog Visible)`.
  - Switch `Cho phép chạy ở Runtime (Execution Allowed)`.
  - Ô nhập lý do (5–500 ký tự).
  - Cảnh báo trực quan: "Tắt quyền thực thi sẽ làm các workflow đang chạy chứa node này bị dừng lỗi."
- `useAdminNodeTypes.ts`: Hook TanStack Query quản lý query keys `['admin', 'node-types']`.
