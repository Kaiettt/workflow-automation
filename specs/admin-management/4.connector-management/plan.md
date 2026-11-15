# Kế hoạch Triển khai: Quản lý Connector và Chính sách Credential (Connector Management)

Status: ready-for-agent (P1)

## 1. Mục tiêu và Phạm vi
Giai đoạn G4 triển khai tính năng quản lý danh mục Connector và kiểm soát chính sách tạo mới credential (`allowNewCredentials`), đảm bảo tính bền vững qua khởi động lại và chống race condition.

## 2. Kế hoạch Triển khai Chi tiết

### Bước 1: Database Migration & Schema
- Cập nhật file `monolith-backend/prisma/schema.prisma` bổ sung model `ConnectorPolicy`.
- Tạo migration `20261116000000_admin_p1` (hoặc migration con cho connector policy).
- Chạy `prisma migrate dev` / `prisma generate`.

### Bước 2: Tách biệt Quá trình Đồng bộ Catalog (`PackageCatalogSync`)
- Mở `monolith-backend/libs/node-library/src/infrastructure/package-catalog.sync.ts`.
- Đảm bảo hàm `sync()` chỉ upsert vào bảng `connectors`, không chạm vào bảng `connector_policies`.

### Bước 3: Backend Application & Commands
- Tạo `ChangeConnectorPolicyCommand` trong `libs/connector/src/application/commands/`.
- Cài đặt handler sử dụng advisory lock `7261102`, kiểm tra `expectedRevision`, cập nhật chính sách, tăng revision và ghi `admin_audit_events` (`CONNECTOR_POLICY_CHANGED`).
- Thêm gate kiểm tra vào:
  - `CreateApiKeyCredentialCommand`
  - `GetGoogleAuthUrlQuery` & `HandleGoogleCallbackCommand`
  - `OAuth2Controller.auth` & `OAuth2Service.complete`

### Bước 4: Backend Query Projection
- Mở rộng `AdminReadPort` với `.connectors(filter)` và `.connector(id)`.
- Triển khai trong `PrismaAdminRead`:
  - Join `connectors` với `connector_policies`.
  - Tính `credentialCount` qua `tx.connectorCredential.count()`.
  - Tính `workflowCount` trên các workflow đã phát hành (`status = 'PUBLISHED'`).

### Bước 5: Presentation Endpoints
- Thêm `GET /api/admin/connectors`, `GET /api/admin/connectors/:id`, `PATCH /api/admin/connectors/:id/credential-policy` trong `AdminController`.
- Cài đặt DTO validation và guard `@AdminBodyFields('allowNewCredentials')`.

### Bước 6: Frontend Development
- Cập nhật `admin.types.ts` và `admin.service.ts`.
- Xây dựng hook `useAdminConnectors.ts`.
- Tạo `ConnectorTable.tsx`, `ConnectorPolicyDialog.tsx`, `ConnectorUsageCard.tsx`.
- Tạo trang `ConnectorsPage.tsx`.
- Cập nhật giao diện Designer Client hiển thị trạng thái cấm tạo mới.

### Bước 7: Kiểm thử Tự động
- Viết unit test cho `ChangeConnectorPolicyCommand`.
- Viết integration test cho race condition tại callback OAuth.
- Viết test xác nhận `PackageCatalogSync` không ghi đè chính sách.
