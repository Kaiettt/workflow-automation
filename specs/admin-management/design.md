# Thiết kế Kiến trúc Khu vực Admin (Admin Management Architecture)

Status: ready-for-agent

Tài liệu này đặc tả kiến trúc toàn diện của module Quản trị (Admin), bao gồm:
1. **Phần đã triển khai (PR #39 - P0)**: FR-AD-01 đến FR-AD-07, Ghi nhật ký tài khoản FR-AD-11.
2. **Phần mở rộng đặc tả (P1)**: 
   - G4: Quản lý Connector & Chính sách Credential (`allowNewCredentials`)
   - G5: Quản lý Loại Node (`isCatalogVisible` & `isExecutionAllowed`)
   - G6: Giám sát Execution & Bảng Node Logs an toàn
   - G7: Trình tra cứu Nhật ký Quản trị (Audit Log Viewer)

---

## 1. Ranh giới Module và Phân tầng Kiến trúc (Clean Architecture & CQRS)

```
                                  ┌────────────────────────┐
                                  │      HTTP Request      │
                                  └───────────┬────────────┘
                                              │
                                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Presentation Layer (libs/admin/src/presentation)                                      │
│                                                                                        │
│   JwtAuthGuard ──► RolesGuard(ADMIN) ──► AdminMutationFieldsGuard                      │
│                                │                                                       │
│                                ▼                                                       │
│                         AdminController                                                │
│                          │            │                                                │
│         (Commands)       │            │       (Queries)                                │
│                          ▼            ▼                                                │
│                      CommandBus    QueryBus                                            │
└──────────────────────────┼────────────┼────────────────────────────────────────────────┘
                           │            │
            ┌──────────────┘            └──────────────┐
            ▼                                          ▼
┌───────────────────────────────────┐      ┌─────────────────────────────────────────────┐
│ Domain / Application Ports        │      │ Admin Projection Layer                      │
│                                   │      │ (libs/admin/src/application/ports)          │
│ • libs/auth:                      │      │                                             │
│   - ManageAccountCommand          │      │ • AdminReadPort                             │
│   - AccountAdministrationPort     │      │   - users(), user(), workflows()            │
│ • libs/connector:                 │      │   - dashboard()                             │
│   - ChangeConnectorPolicyCommand  │      │   - connectors(), connector() [G4]          │
│   - ConnectorPolicyPort           │      │   - nodeTypes(), nodeType() [G5]            │
│ • libs/node-library:              │      │   - executions(), execution() [G6]          │
│   - ChangeNodeTypeStatusCommand   │      │   - auditEvents(), auditEvent() [G7]        │
│   - NodeTypePolicyPort            │      │                                             │
│ • libs/database:                  │      │ Implementation:                             │
│   - TransactionAuditWriter        │      │ • PrismaAdminRead                           │
└──────────────────┬────────────────┘      └──────────────────────┬──────────────────────┘
                   │                                              │
                   ▼                                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Infrastructure / Persistence (PostgreSQL & Redis)                                      │
│                                                                                        │
│  • users (revision, session_version)                                                   │
│  • admin_audit_events (immutable audit log)                                            │
│  • session_revocations (outbox for Redis invalidation)                                 │
│  • connector_policies (allow_new_credentials, revision) [G4]                           │
│  • node_type_policies (is_catalog_visible, is_execution_allowed, revision) [G5]         │
│  • executions, execution_node_logs (safe metadata indexing) [G6]                       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Nguyên tắc ranh giới:
1. `AdminController` chỉ đóng vai trò Presentation: Nhận DTO, xác thực bảo mật, đẩy qua `CommandBus` hoặc `QueryBus`. Không tiêm trực tiếp `PrismaService` vào controller.
2. **Commands**: Các nghiệp vụ tác động dữ liệu (mutations) thuộc về các domain tương ứng (`Auth` cho tài khoản, `Connector` cho chính sách kết nối, `NodeLibrary` cho trạng thái node type). Mọi mutation đều nhận `expectedRevision`, lấy advisory lock, thực hiện atomic transaction và phát sinh audit event.
3. **Queries**: Được định nghĩa trong `AdminReadPort` và triển khai tại `PrismaAdminRead`. Query sử dụng các lệnh SELECT projection an toàn tuyệt đối, phân trang server-side và tuyệt đối không bao giờ truy vấn các cột nhạy cảm (`input`, `output`, `encrypted_secret`, `error_stack`, `error_message`).

---

## 2. Mô hình Dữ liệu và Schema Database

### 2.1. Các bảng hiện có (Được bảo toàn nguyên vẹn từ PR #39)
- `users`: Bổ sung `revision` (Int, default 0), `session_version` (Int, default 0).
- `admin_audit_events`: Lưu vết kiểm toán bất biến (`id`, `actor_type`, `actor_id`, `action`, `target_id`, `target_type`, `reason`, `before`, `after`, `created_at`).
- `session_revocations`: Hàng đợi outbox dọn dẹp token trong Redis (`id`, `user_id`, `session_version`, `created_at`, `completed_at`).
- `executions`: Bổ sung cột chuẩn hóa `error_code`, `cancellation_reason`.
- `execution_node_logs`: Bổ sung cột chuẩn hóa `error_code`.
- `connectors`: Catalog kỹ thuật (`id`, `key`, `name`, `auth_type`, `config_schema`, `is_active`).
- `node_type_definitions`: Catalog node kỹ thuật (`id`, `key`, `display_name`, `category`, `config_schema`, `is_active`).

### 2.2. Các bảng mới cho P1 (Migration `20261116000000_admin_p1`)

```prisma
// ----------------------------------------------------------------------------
// Admin Connector Policies (G4)
// Tách biệt chính sách quản trị khỏi bảng kỹ thuật connectors
// để PackageCatalogSync không ghi đè chính sách khi server khởi động lại.
// ----------------------------------------------------------------------------
model ConnectorPolicy {
  connectorId         String   @id @map("connector_id") @db.Uuid
  connector           Connector @relation(fields: [connectorId], references: [id], onDelete: Cascade)
  allowNewCredentials Boolean  @default(true) @map("allow_new_credentials")
  revision            Int      @default(0)
  updatedAt           DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@map("connector_policies")
}

// ----------------------------------------------------------------------------
// Admin Node Type Policies (G5)
// Tách biệt trạng thái hiển thị Palette và quyền thực thi khỏi bảng kỹ thuật
// ----------------------------------------------------------------------------
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

*Lưu ý kiến trúc*: Nếu một connector hoặc node type chưa có bản ghi trong bảng policy tương ứng, hệ thống ngầm định giá trị mặc định là `allowNewCredentials = true`, `isCatalogVisible = true`, `isExecutionAllowed = true`, `revision = 0`. Điều này đảm bảo tính tương thích ngược hoàn hảo (Zero downtime migration).

---

## 3. Chi tiết Hợp đồng API và DTO Whitelist (API Contracts)

### 3.1. Nhóm Quản lý Connector (G4)

#### `GET /api/admin/connectors`
- **Query Params**: `page` (int, default 1), `pageSize` (int, default 20), `q` (string, optional), `authType` (enum, optional), `isActive` (boolean, optional), `allowNewCredentials` (boolean, optional).
- **Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "c8b417c8-043e-4731-8c4d-9488a03f443b",
        "key": "google-sheets",
        "name": "Google Sheets",
        "authType": "OAUTH2",
        "isActive": true,
        "allowNewCredentials": false,
        "revision": 2,
        "credentialCount": 15,
        "workflowCount": 8,
        "createdAt": "2026-11-01T00:00:00.000Z",
        "updatedAt": "2026-11-15T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

#### `GET /api/admin/connectors/:id`
- Trả về thông tin chi tiết của connector, danh sách các `nodeTypes` trực thuộc (`key`, `displayName`, `category`), thống kê sử dụng và chính sách hiện tại.

#### `PATCH /api/admin/connectors/:id/credential-policy`
- **Guarded Fields**: `@AdminBodyFields('allowNewCredentials')`
- **Request Body**:
```json
{
  "allowNewCredentials": false,
  "reason": "Dịch vụ Google Sheets API đang bảo trì chính sách xác thực OAuth mới",
  "expectedRevision": 2
}
```
- **Response**: Trả về connector metadata đã cập nhật, `revision: 3`, và `auditEventId`.

---

### 3.2. Nhóm Quản lý Loại Node - Node Types (G5)

#### `GET /api/admin/node-types`
- **Query Params**: `page`, `pageSize`, `q`, `category`, `connectorId`, `isCatalogVisible`, `isExecutionAllowed`.
- **Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "e2a1b3c4-...",
        "key": "integration.slack.postMessage",
        "displayName": "Send Slack Message",
        "icon": "slack",
        "color": "#4A154B",
        "category": "INTEGRATION",
        "connectorKey": "slack",
        "connectorName": "Slack",
        "isCatalogVisible": true,
        "isExecutionAllowed": true,
        "revision": 1,
        "publishedWorkflowCount": 24,
        "draftWorkflowCount": 5,
        "createdAt": "2026-11-01T00:00:00.000Z",
        "updatedAt": "2026-11-15T09:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

#### `GET /api/admin/node-types/:key`
- Trả về metadata chi tiết, `configSchema`, `inputSchema`, `outputSchema`, danh sách top workflows sử dụng (chỉ gồm `id`, `name`, `ownerEmail`, `status`).

#### `PATCH /api/admin/node-types/:key/status`
- **Guarded Fields**: `@AdminBodyFields('isCatalogVisible', 'isExecutionAllowed')`
- **Request Body**:
```json
{
  "isCatalogVisible": false,
  "isExecutionAllowed": true,
  "reason": "Tạm ẩn node gửi tin nhắn Slack khỏi Designer để nâng cấp schema v2",
  "expectedRevision": 1
}
```
- **Response**: Bản ghi cập nhật, `revision: 2`, và `auditEventId`.

---

### 3.3. Nhóm Giám sát Execution (G6)

#### `GET /api/admin/executions`
- **Query Params**: `page`, `pageSize`, `ownerId`, `workflowId`, `executionId`, `status`, `triggerType`, `from`, `to`.
- **Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "a90184b2-...",
        "workflowId": "w123-...",
        "workflowName": "Order Processing Sync",
        "ownerId": "u456-...",
        "ownerName": "Nguyen Van A",
        "ownerEmail": "vana@example.com",
        "versionId": "v789-...",
        "versionNumber": 3,
        "triggerType": "WEBHOOK",
        "status": "FAILED",
        "queuedAt": "2026-11-15T08:30:00.000Z",
        "startedAt": "2026-11-15T08:30:01.000Z",
        "finishedAt": "2026-11-15T08:30:05.000Z",
        "durationMs": 4000,
        "errorCode": "CONNECTOR_TIMEOUT",
        "cancellationReason": null
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

#### `GET /api/admin/executions/:id`
- **Response**: Trả về metadata execution (như trên) và mảng `nodeLogs`:
```json
{
  "success": true,
  "data": {
    "id": "a90184b2-...",
    "workflowId": "w123-...",
    "workflowName": "Order Processing Sync",
    "ownerId": "u456-...",
    "ownerName": "Nguyen Van A",
    "ownerEmail": "vana@example.com",
    "versionNumber": 3,
    "triggerType": "WEBHOOK",
    "status": "FAILED",
    "queuedAt": "2026-11-15T08:30:00.000Z",
    "startedAt": "2026-11-15T08:30:01.000Z",
    "finishedAt": "2026-11-15T08:30:05.000Z",
    "durationMs": 4000,
    "errorCode": "CONNECTOR_TIMEOUT",
    "cancellationReason": null,
    "nodeLogs": [
      {
        "nodeId": "webhook-trigger",
        "nodeKey": "trigger.webhook",
        "status": "SUCCESS",
        "startedAt": "2026-11-15T08:30:01.000Z",
        "finishedAt": "2026-11-15T08:30:01.100Z",
        "durationMs": 100,
        "retryCount": 0,
        "errorCode": null
      },
      {
        "nodeId": "slack-post-1",
        "nodeKey": "integration.slack.postMessage",
        "status": "FAILED",
        "startedAt": "2026-11-15T08:30:01.200Z",
        "finishedAt": "2026-11-15T08:30:05.000Z",
        "durationMs": 3800,
        "retryCount": 3,
        "errorCode": "CONNECTOR_TIMEOUT"
      }
    ]
  }
}
```

#### Bảng Kiểm soát Rò rỉ Dữ liệu Nhạy cảm (Privacy & Security Projection Matrix)

| Thuộc tính nguồn | Có trong Admin Projection? | Lý do kỹ thuật & bảo mật |
| --- | --- | --- |
| `Execution.id`, `workflowId`, `status`, `triggerType` | **CÓ** | Metadata vận hành bắt buộc |
| `Execution.queuedAt`, `startedAt`, `finishedAt`, `durationMs` | **CÓ** | Chỉ số hiệu năng (timing) |
| `Execution.errorCode`, `cancellationReason` | **CÓ** | Mã lỗi chuẩn hóa an toàn |
| `Execution.context` | **KHÔNG** | Chứa biến môi trường và dữ liệu chạy workflow của Client |
| `Execution.input`, `Execution.output` | **KHÔNG** | Chứa dữ liệu nghiệp vụ nhạy cảm của Client |
| `ExecutionNodeLog.input`, `output` | **KHÔNG** | Chứa payload/token/tin nhắn gửi nhận của Client |
| `ExecutionNodeLog.errorMessage` | **KHÔNG** | Chuỗi lỗi thô của third-party có thể in kèm header/token/query param |
| `ExecutionNodeLog.errorStack` | **KHÔNG** | Stack trace nội bộ có thể làm lộ cấu trúc hệ thống hoặc secret |
| `WorkflowNode.name` (Custom Label) | **KHÔNG** | Người dùng có thể đặt tên node nhạy cảm ("Gửi API key cho đối tác") |

---

### 3.4. Nhóm Nhật ký Quản trị - Audit Logs (G7)

#### `GET /api/admin/audit-events`
- **Query Params**: `page`, `pageSize`, `actorId`, `actorType` (`ADMIN`, `SYSTEM`), `action`, `targetType` (`USER`, `CONNECTOR`, `NODE_TYPE`), `targetId`, `from`, `to`.
- **Response**: Danh sách sự kiện tóm tắt, sắp xếp `createdAt desc`, `id desc`.

#### `GET /api/admin/audit-events/:id`
- **Response**:
```json
{
  "success": true,
  "data": {
    "id": "f51234a1-...",
    "actorType": "ADMIN",
    "actorId": "u001-...",
    "actorName": "Le Admin",
    "actorEmail": "admin@flowpilot.local",
    "action": "CONNECTOR_POLICY_CHANGED",
    "targetType": "CONNECTOR",
    "targetId": "c8b417c8-043e-4731-8c4d-9488a03f443b",
    "targetName": "Google Sheets",
    "reason": "Dịch vụ Google Sheets API đang bảo trì chính sách xác thực OAuth mới",
    "before": { "allowNewCredentials": true, "revision": 2 },
    "after": { "allowNewCredentials": false, "revision": 3 },
    "createdAt": "2026-11-15T10:00:00.000Z"
  }
}
```

---

## 4. Xử lý Đồng thời, Chống Race Condition và Giao dịch Database

### 4.1. Hệ thống Khóa Quản trị (PostgreSQL Advisory Locks)
Để chống race condition giữa nhiều Admin hoặc giữa Admin và Client, hệ thống sử dụng các Transaction Advisory Lock riêng biệt:
- **Tài khoản người dùng**: `SELECT pg_advisory_xact_lock(7261101)`
- **Chính sách Connector**: `SELECT pg_advisory_xact_lock(7261102)`
- **Chính sách Node Type**: `SELECT pg_advisory_xact_lock(7261103)`

### 4.2. Xử lý Race Condition tại luồng tạo Credential (G4)
Khi người dùng bấm "Connect with Google":
1. Bắt đầu OAuth (`/api/integrations/google/auth`): Kiểm tra `allowNewCredentials`. Nếu `false`, từ chối ngay.
2. Hoàn tất OAuth (`/api/integrations/google/callback`):
   - Mở database transaction.
   - Lấy advisory lock hoặc row-lock `SELECT ... FROM connector_policies WHERE connector_id = $1 FOR UPDATE`.
   - Kiểm tra lại `allowNewCredentials`.
   - Nếu `false`: Rollback transaction, hủy lưu trữ credential, trả về lỗi `409 Conflict` (mã `CONNECTOR_NEW_CREDENTIALS_DISABLED`).
   - Nếu `true`: Lưu `ConnectorCredential`, commit transaction.
   *Cơ chế này áp dụng tương tự cho API Key credential và Package OAuth2.*

### 4.3. Xử lý Tính tương thích và Chặn Runtime ở Node Type (G5)
1. **Designer Palette Filtering**: `NodeTypesController.getNodeTypes()` truy vấn kết hợp bảng `node_type_definitions` và `node_type_policies`:
   - Lọc bỏ các node có `isCatalogVisible === false`.
2. **Runtime Execution Enforcement (`NodeRunner`)**:
   - Khi engine nạp node để thực thi: `NodeRunner` kiểm tra cờ `isExecutionAllowed` của `nodeKey`.
   - Nếu `isExecutionAllowed === false`: 
     - Không gọi `executor.execute()`.
     - Ghi nhận `ExecutionNodeLog` với status `FAILED`, `errorCode = 'NODE_TYPE_DISABLED'`.
     - Ném `NodeTypeDisabledException` để workflow engine xử lý theo kịch bản lỗi chuẩn hóa.

---

## 5. Thiết kế Giao diện Frontend (UI Architecture)

Tổ chức trong `frontend/src/features/admin`:

```
frontend/src/features/admin/
├── components/
│   ├── AdminLayout.tsx            # Cập nhật menu tabs: Overview, Users, Connectors, Node Types, Executions, Audit Logs
│   ├── AdminGuard.tsx             # Route guard bảo vệ phân quyền
│   ├── accounts/                  # Components quản lý tài khoản (P0)
│   ├── dashboard/                 # Components dashboard & biểu đồ (P0)
│   ├── connectors/                # [G4 Mới]
│   │   ├── ConnectorTable.tsx     # Bảng danh mục connector, badges authType, counts
│   │   ├── ConnectorPolicyDialog.tsx # Dialog xác nhận đổi allowNewCredentials kèm reason
│   │   └── ConnectorUsageCard.tsx # Thống kê số lượng workflow/credentials liên kết
│   ├── node-types/                # [G5 Mới]
│   │   ├── NodeTypeTable.tsx      # Bảng danh mục node, icon, category badges
│   │   ├── NodeTypeStatusDialog.tsx  # Dialog bật/tắt isCatalogVisible & isExecutionAllowed
│   │   └── NodeTypeDetailCard.tsx # Xem schemas và danh sách workflow sử dụng
│   ├── executions/                # [G6 Mới]
│   │   ├── ExecutionFilterBar.tsx # Bộ lọc đa chiều (owner, workflow, status, trigger, time)
│   │   ├── ExecutionTable.tsx     # Bảng danh sách execution an toàn
│   │   └── NodeLogsTimeline.tsx   # Bảng trạng thái các node log (timing, status, safe errorCode)
│   └── audit/                     # [G7 Mới]
│       ├── AuditEventFilterBar.tsx# Bộ lọc actor, action, target, time
│       ├── AuditEventTable.tsx    # Bảng danh sách kiểm toán, badges hành động
│       └── AuditDiffDialog.tsx    # Dialog hiển thị trực quan Before vs After diff
├── hooks/
│   ├── useAdmin.ts                # TanStack Query hooks cho users, dashboard
│   ├── useAdminConnectors.ts      # [G4 Mới] hooks cho connector list/detail/mutation
│   ├── useAdminNodeTypes.ts       # [G5 Mới] hooks cho node types list/detail/mutation
│   ├── useAdminExecutions.ts      # [G6 Mới] hooks cho execution monitoring (visible polling)
│   └── useAdminAudit.ts           # [G7 Mới] hooks cho audit logs
├── pages/
│   ├── DashboardPage.tsx          # P0
│   ├── UsersPage.tsx              # P0
│   ├── UserDetailPage.tsx         # P0
│   ├── ConnectorsPage.tsx         # [G4 Mới]
│   ├── NodeTypesPage.tsx          # [G5 Mới]
│   ├── ExecutionsPage.tsx         # [G6 Mới]
│   ├── ExecutionDetailPage.tsx    # [G6 Mới]
│   └── AuditEventsPage.tsx        # [G7 Mới]
├── services/
│   └── admin.service.ts           # API client mở rộng đầy đủ các endpoints
└── types/
    └── admin.types.ts             # TypeScript interfaces cho toàn bộ DTOs
```

### Quy tắc Polling kiểm soát (Visible-only Polling):
Áp dụng cho `DashboardPage`, `ExecutionsPage`, `ExecutionDetailPage`:
```typescript
const isVisible = useDocumentVisibility() === 'visible';
const { data, refetch } = useQuery({
  queryKey: ['admin', 'executions', filters],
  queryFn: () => adminService.executions(filters),
  refetchInterval: isVisible ? 30000 : false,
});
```

---

## 6. Ma trận Truy vết Yêu cầu (Traceability Matrix)

| Yêu cầu (Spec) | Tiêu chí nghiệm thu (AC) | Thiết kế thành phần phụ trách | Phương pháp kiểm chứng |
| --- | --- | --- | --- |
| FR-AD-01 (Auth) | AC-01, AC-02, AC-03 | `JwtAuthGuard`, `RolesGuard(ADMIN)`, register DTO pipe | HTTP Test, Auth Integration Suite |
| FR-AD-02..05 (Users) | AC-04..AC-08 | `AdminController`, `ManageAccountCommand`, Advisory Lock `7261101` | Concurrency Test, Postgres Real Transaction |
| FR-AD-06 (Tokens) | AC-04, AC-08 | `users.session_version`, Redis Outbox cleanup | Token Revocation Test, SSE Heartbeat Test |
| FR-AD-07 (Dashboard) | AC-14, AC-16, AC-17 | `PrismaAdminRead.dashboard()`, `DashboardPage` | Aggregate Test, Timezone Boundary Test |
| FR-AD-08..09 (Connectors) | AC-10, AC-11, AC-18, AC-19 | `connector_policies`, `ChangeConnectorPolicyCommand`, OAuth gates | Callback Race Condition Test, Sync Recheck Test |
| FR-AD-10..11 (Node Types) | AC-20, AC-21, AC-22, AC-23 | `node_type_policies`, `ChangeNodeTypeStatusCommand`, `NodeRunner` gate | Palette Filter Test, Runtime Disabled Node Test |
| FR-AD-12 (Executions) | AC-12, AC-24, AC-25, AC-26 | `PrismaAdminRead.executions()`, Safe Projection Whitelist | Whitelist Leakage Test (Secrets/Payloads), Read-only Test |
| FR-AD-13 (Audit Logs) | AC-09, AC-27, AC-28 | `AdminAuditEvent`, Transaction Audit Writer, `AuditEventsPage` | Atomic Rollback Test, Audit Diff Query Test |
