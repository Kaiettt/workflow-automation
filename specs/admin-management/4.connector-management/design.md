# Thiết kế: Quản lý Connector và Chính sách Credential (Connector Management)

Status: ready-for-agent (P1)

## 1. Ranh giới Module và Phân tầng Kiến trúc

- **Presentation**: `monolith-backend/libs/admin/src/presentation`:
  - `GET /api/admin/connectors` -> `AdminReadQuery({ kind: 'connectors', filter })`
  - `GET /api/admin/connectors/:id` -> `AdminReadQuery({ kind: 'connector', id })`
  - `PATCH /api/admin/connectors/:id/credential-policy` -> `@AdminBodyFields('allowNewCredentials')` -> `ChangeConnectorPolicyCommand`
- **Domain & Application**:
  - `libs/connector/src/application/ports/connector-policy.port.ts`: Interface tra cứu và cập nhật chính sách.
  - `libs/connector/src/application/commands/change-connector-policy.command.ts`: Command handler thực thi thay đổi chính sách trong transaction.
- **Infrastructure & Persistence**:
  - `monolith-backend/prisma/schema.prisma`:
    ```prisma
    model ConnectorPolicy {
      connectorId         String    @id @map("connector_id") @db.Uuid
      connector           Connector @relation(fields: [connectorId], references: [id], onDelete: Cascade)
      allowNewCredentials Boolean   @default(true) @map("allow_new_credentials")
      revision            Int       @default(0)
      updatedAt           DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

      @@map("connector_policies")
    }
    ```
  - `PackageCatalogSync`: Bỏ qua bảng `connector_policies`.

## 2. Hợp đồng API và DTO Whitelist

### DTO Thay đổi Chính sách
```typescript
export class ChangeConnectorPolicyDto {
  @IsBoolean()
  allowNewCredentials!: boolean;

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
export interface ConnectorAdminSummaryDto {
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
```

## 3. Thiết kế Transaction và Xử lý Race Condition

### 3.1. Advisory Lock Quản lý Connector
Mọi thao tác đổi chính sách connector sử dụng advisory lock:
`SELECT pg_advisory_xact_lock(7261102);`

### 3.2. Chống Race Condition tại Callback Lưu Credential
Tại bước hoàn tất lưu trữ credential (`CreateApiKeyCredentialCommand`, `HandleGoogleCallbackCommand`, `OAuth2Service.complete`):
```typescript
await this.prisma.$transaction(async (tx) => {
  // 1. Khóa dòng policy để đọc trạng thái mới nhất
  const policy = await tx.connectorPolicy.findUnique({
    where: { connectorId },
  });

  // 2. Kiểm tra cờ cho phép tạo mới (mặc định true nếu chưa có dòng)
  const isAllowed = policy ? policy.allowNewCredentials : true;
  if (!isAllowed) {
    throw new ConflictException({
      code: 'CONNECTOR_NEW_CREDENTIALS_DISABLED',
      message: 'New credentials for this connector have been disabled by platform administrator',
    });
  }

  // 3. Tiến hành mã hóa và lưu trữ credential
  return tx.connectorCredential.create({
    data: {
      connectorId,
      ownerId: userId,
      name,
      encryptedSecret,
    },
  });
});
```

## 4. Thiết kế Giao diện Frontend

- `ConnectorsPage.tsx`:
  - Thanh tìm kiếm theo tên hoặc key.
  - Dropdown lọc `authType`, dropdown lọc `allowNewCredentials`.
  - Bảng danh mục connector: Icon, Tên, Key, AuthType badge, Badge trạng thái `Active`, Badge chính sách `New Credentials Allowed` / `Disabled`, số credentials, số workflows, nút thao tác "Chính sách (Policy)".
- `ConnectorPolicyDialog.tsx`:
  - Switch bật/tắt `allowNewCredentials`.
  - Ô nhập lý do (5–500 ký tự) có đếm ký tự.
  - Cảnh báo tóm tắt: "Vô hiệu hóa chỉ ngăn người dùng tạo kết nối mới. Các kết nối và workflow hiện hữu tiếp tục hoạt động bình thường."
  - Xử lý lỗi `409 Conflict`: Tự động refetch dữ liệu và thông báo thay đổi cho Admin.
- `useAdminConnectors.ts`: Hook TanStack Query quản lý query keys `['admin', 'connectors']` và mutations.
