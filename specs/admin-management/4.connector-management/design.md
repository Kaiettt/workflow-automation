# Thiết kế Kỹ thuật: Quản lý Connector và Chính sách Credential (TDD & BDD Design)

Status: ready-for-agent (P1)

## 1. Ranh giới Kiến trúc và Các Điểm Seam Kiểm thử (Test Seams)

Hệ thống tuân thủ nghiêm ngặt mô hình **Modular Monolith + Clean Architecture + CQRS**. Các bài kiểm thử theo TDD được thiết kế tại các **Public Seams** rõ ràng, tránh kiểm thử chi tiết cài đặt nội bộ.

```
                           [Frontend UI & React Testing Library Seam]
                                              │
                                              ▼
                                 [Presentation HTTP API Seam]
                           (NestJS AdminController + DTO Whitelist)
                                              │
                                              ▼
                                  [Application CQRS Seam]
                        (Commands / Queries / Domain Policy Ports)
                                 ┌────────────┴────────────┐
                                 ▼                         ▼
                    [In-Memory Doubles Seam]    [Persistence & DB Seam]
                   (Unit Test Fast Feedback)   (Postgres Locks & Transactions)
```

### 1.1. Các Seam Kiểm thử Định nghĩa trước (Pre-agreed Seams)

1. **Application Seam (`ChangeConnectorPolicyHandler`, `CredentialGates`)**:
   - **Boundary**: Giao diện Port và Command Handler (`IConnectorPolicyPort`, `ChangeConnectorPolicyCommand`).
   - **Mục tiêu TDD**: Kiểm tra logic nghiệp vụ thuần túy: kiểm tra revision, xử lý no-op, điều kiện chặn tạo credential mới, tính toán trạng thái chính sách.
   - **Test Double**: `InMemoryConnectorPolicyRepository` độc lập hoàn toàn với database, đảm bảo kiểm thử chạy cực nhanh (< 10ms).
2. **Persistence & Concurrency Seam (`PrismaConnectorPolicyAdapter`, Database Transactions)**:
   - **Boundary**: Tầng tương tác PostgreSQL với `pg_advisory_xact_lock` và transaction row locking.
   - **Mục tiêu TDD**: Kiểm tra race condition thực tế khi 2 request cập nhật policy cùng lúc, và race condition giữa Admin tắt policy với Google/OAuth2 callback đang hoàn tất.
3. **Presentation HTTP Seam (`AdminController`)**:
   - **Boundary**: HTTP endpoints `/api/admin/connectors/*`.
   - **Mục tiêu TDD**: Kiểm tra class-validator, serialization, HTTP status code (200, 400, 409 Conflict), projection an toàn không lộ secret.
4. **Frontend Component & Hook Seam (`ConnectorsPage`, `useAdminConnectors`)**:
   - **Boundary**: React Testing Library tương tác qua Accessible Roles (`getByRole('button')`, `getByRole('table')`) và TanStack Query.
   - **Mục tiêu TDD**: Kiểm tra hành vi UI khi load dữ liệu, submit form đổi chính sách, hiển thị cảnh báo lỗi `STALE_REVISION`, và render banner cảnh báo trong Designer.

---

## 2. Mô hình Dữ liệu và Schema Database

### 2.1. Prisma Schema (`monolith-backend/prisma/schema.prisma`)

Tách biệt hoàn toàn bảng cấu hình nghiệp vụ quản trị `connector_policies` khỏi bảng danh mục kỹ thuật `connectors`:

```prisma
model Connector {
  id          String                @id @default(uuid()) @db.Uuid
  key         String                @unique @db.VarChar(100)
  name        String                @db.VarChar(255)
  authType    ConnectorAuthType     @default(NONE) @map("auth_type")
  isActive    Boolean               @default(true) @map("is_active")
  createdAt   DateTime              @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime              @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  policy      ConnectorPolicy?
  credentials ConnectorCredential[]
  nodeTypes   NodeType[]

  @@map("connectors")
}

model ConnectorPolicy {
  connectorId         String    @id @map("connector_id") @db.Uuid
  connector           Connector @relation(fields: [connectorId], references: [id], onDelete: Cascade)
  allowNewCredentials Boolean   @default(true) @map("allow_new_credentials")
  revision            Int       @default(0)
  updatedAt           DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@map("connector_policies")
}

enum ConnectorAuthType {
  NONE
  API_KEY
  OAUTH2
  BASIC
}
```

### 2.2. Sự độc lập của `PackageCatalogSync`

File `monolith-backend/libs/node-library/src/infrastructure/package-catalog.sync.ts`:
- Tiến trình `sync()` chỉ thực hiện `prisma.connector.upsert({ where: { key }, update: { ...techProps }, create: { ...techProps } })`.
- Tuyệt đối **không chạm vào** bảng `connector_policies`.
- Khi một connector mới xuất hiện trong catalog mà chưa có bản ghi policy: Logic hệ thống coi giá trị mặc định là `allowNewCredentials = true`, `revision = 0`.

---

## 3. Thiết kế Chi tiết Tầng Application & Domain

### 3.1. Domain Interface & Port (`libs/connector/src/domain/ports/connector-policy.port.ts`)

```typescript
export interface ConnectorPolicySnapshot {
  connectorId: string;
  allowNewCredentials: boolean;
  revision: number;
  updatedAt: Date;
}

export interface IConnectorPolicyPort {
  getPolicy(connectorId: string): Promise<ConnectorPolicySnapshot>;
  updatePolicyWithLock(params: {
    connectorId: string;
    allowNewCredentials: boolean;
    reason: string;
    expectedRevision: number;
    adminId: string;
  }): Promise<{ updated: boolean; policy: ConnectorPolicySnapshot }>;
  assertCanCreateCredential(connectorId: string): Promise<void>;
}
```

### 3.2. Advisory Lock và Thuật toán Command Handler

`ChangeConnectorPolicyHandler` sử dụng mã khóa số: `7261102` (mã định danh quy ước cho Connector Policy Management):

```typescript
// Algorithm in ChangeConnectorPolicyHandler:
async execute(command: ChangeConnectorPolicyCommand): Promise<ConnectorPolicySnapshot> {
  const { connectorId, allowNewCredentials, reason, expectedRevision, adminId } = command;

  return this.prisma.$transaction(async (tx) => {
    // 1. Acquire advisory lock scoped to transaction
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7261102);`;

    // 2. Fetch existing policy with row-level lock or query
    const current = await tx.connectorPolicy.findUnique({
      where: { connectorId },
    });

    const currentAllow = current ? current.allowNewCredentials : true;
    const currentRevision = current ? current.revision : 0;

    // 3. Stale revision check (Optimistic Concurrency Control)
    if (currentRevision !== expectedRevision) {
      throw new ConflictException({
        code: 'STALE_REVISION',
        message: `Policy revision mismatch. Expected ${expectedRevision}, but found ${currentRevision}.`,
      });
    }

    // 4. No-op check: If unchanged, return current state without bumping revision or logging audit
    if (currentAllow === allowNewCredentials) {
      return {
        connectorId,
        allowNewCredentials: currentAllow,
        revision: currentRevision,
        updatedAt: current?.updatedAt ?? new Date(),
      };
    }

    // 5. Upsert policy with revision increment
    const updated = await tx.connectorPolicy.upsert({
      where: { connectorId },
      create: {
        connectorId,
        allowNewCredentials,
        revision: currentRevision + 1,
      },
      update: {
        allowNewCredentials,
        revision: currentRevision + 1,
      },
    });

    // 6. Record atomic audit event in admin_audit_events
    await tx.adminAuditEvent.create({
      data: {
        actorId: adminId,
        action: 'CONNECTOR_POLICY_CHANGED',
        targetType: 'CONNECTOR',
        targetId: connectorId,
        reason,
        payload: {
          previous: { allowNewCredentials: currentAllow, revision: currentRevision },
          current: { allowNewCredentials, revision: updated.revision },
        },
      },
    });

    return updated;
  });
}
```

---

## 4. Kiểm soát Toàn diện Gate Tạo Credential & Chống Race Condition

### 4.1. Gate tại `CreateApiKeyCredentialCommand`
```typescript
// Inside CreateApiKeyCredentialHandler:
await this.connectorPolicyPort.assertCanCreateCredential(command.connectorId);
// Proceed to encrypt and persist credential
```

### 4.2. Gate tại Google OAuth
- **Khởi tạo (`GetGoogleAuthUrlQuery`)**:
  - Đọc policy; nếu `!allowNewCredentials` -> Ném ngay `ConflictException('CONNECTOR_NEW_CREDENTIALS_DISABLED')`.
- **Hoàn tất Callback (`HandleGoogleCallbackCommand`)**:
  - Chạy trong database transaction:
  ```typescript
  return this.prisma.$transaction(async (tx) => {
    // Lock row to read fresh status
    const policy = await tx.connectorPolicy.findUnique({
      where: { connectorId },
    });
    const isAllowed = policy ? policy.allowNewCredentials : true;

    if (!isAllowed) {
      throw new ConflictException({
        code: 'CONNECTOR_NEW_CREDENTIALS_DISABLED',
        message: 'New credentials for this connector have been disabled by administrator',
      });
    }

    // Safe to store encrypted OAuth token
    return tx.connectorCredential.create({ ... });
  });
  ```

### 4.3. Gate tại Package OAuth2
- Chặn tại `OAuth2Controller.auth`: Kiểm tra policy trước khi sinh redirect URL.
- Re-check bắt buộc trong transaction tại `OAuth2Service.complete`: Đảm bảo không xảy ra race condition.

---

## 5. Hợp đồng Presentation API & DTO Whitelist

### 5.1. DTO Thay đổi Chính sách (`ChangeConnectorPolicyDto`)
```typescript
import { IsBoolean, IsInt, IsString, Length, Min } from 'class-validator';

export class ChangeConnectorPolicyDto {
  @IsBoolean()
  allowNewCredentials!: boolean;

  @IsString()
  @Length(5, 500, { message: 'Lý do thay đổi phải từ 5 đến 500 ký tự' })
  reason!: string;

  @IsInt()
  @Min(0)
  expectedRevision!: number;
}
```

### 5.2. Projection Response DTO
```typescript
export interface ConnectorAdminListItemDto {
  id: string;
  key: string;
  name: string;
  authType: 'NONE' | 'API_KEY' | 'OAUTH2' | 'BASIC';
  isActive: boolean;
  allowNewCredentials: boolean;
  revision: number;
  credentialCount: number;
  workflowCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorAdminListResponseDto {
  items: ConnectorAdminListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

---

## 6. Thiết kế Frontend & React Testing Strategy

### 6.1. Component Hierarchy
- `ConnectorsPage.tsx`: Màn hình chính quản lý Connectors.
  - `ConnectorFilters.tsx`: Ô tìm kiếm theo tên/key + Dropdown lọc `authType` + Dropdown lọc `allowNewCredentials`.
  - `ConnectorTable.tsx`: Danh sách connectors (Name, Key, Type badge, Active badge, Policy badge, Usage stats, Action button).
  - `ConnectorPolicyDialog.tsx`: Dialog thay đổi chính sách có xác nhận, ô nhập lý do (5-500 ký tự), hiển thị cảnh báo tác động.
- Designer Integration:
  - `ConnectorDisabledBanner.tsx`: Hiển thị cảnh báo trực quan trong node configuration dialog khi người dùng mở cấu hình của connector bị ngưng cấp mới.

### 6.2. Test Double & Mocking Strategy (Frontend RTL)
- Sử dụng Vitest + `@testing-library/react`.
- Mocking: Mock `admin.service.ts` hoặc sử dụng MSW. Không mock internals của React Query hook.
- Kiểm thử các vai trò Accessibility (`getByRole('table')`, `getByRole('button', { name: /Chính sách/i })`, `getByLabelText(/Lý do/i)`).
