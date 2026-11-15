# Checklist: Quản lý Connector và Chính sách Credential (Connector Management)

Status: ready-for-agent (P1)

- [ ] G4.1 **Database Migration**: Bổ sung model `ConnectorPolicy` vào `monolith-backend/prisma/schema.prisma` và tạo migration cơ sở dữ liệu.
- [ ] G4.2 **Catalog Sync Protection**: Sửa `PackageCatalogSync` (`monolith-backend/libs/node-library/src/infrastructure/package-catalog.sync.ts`) để chỉ upsert bảng `connectors`, không chạm vào `connector_policies`.
- [ ] G4.3 **Connector Policy Port & Command**:
  - Tạo `ChangeConnectorPolicyCommand` trong `libs/connector/src/application/commands/`.
  - Triển khai handler: Lấy advisory lock `7261102`, kiểm tra `expectedRevision`, no-op, cập nhật policy, tăng revision và ghi `admin_audit_events` (`CONNECTOR_POLICY_CHANGED`) atomic.
- [ ] G4.4 **Credential Gates & Chống Race Condition**:
  - Gắn gate vào `CreateApiKeyCredentialCommand`: Kiểm tra `allowNewCredentials` trước khi mã hóa và lưu trữ.
  - Gắn gate vào Google OAuth: Kiểm tra tại `GetGoogleAuthUrlQuery` và kiểm tra lại bắt buộc với lock transaction trong `HandleGoogleCallbackCommand`.
  - Gắn gate vào Package OAuth2: Kiểm tra tại `OAuth2Controller.auth` và re-check bắt buộc trong transaction tại `OAuth2Service.complete`.
  - Trả về lỗi `409 Conflict` kèm mã `CONNECTOR_NEW_CREDENTIALS_DISABLED`.
- [ ] G4.5 **Admin Projection & Query**:
  - Bổ sung `AdminReadPort.connectors()` và `AdminReadPort.connector(id)`.
  - Triển khai tính toán `credentialCount` và `workflowCount` (distinct published workflows).
  - Thêm endpoint `GET /api/admin/connectors`, `GET /api/admin/connectors/:id`, `PATCH /api/admin/connectors/:id/credential-policy` trong `AdminController`.
- [ ] G4.6 **Frontend Components & Hooks**:
  - Cập nhật `admin.types.ts` và `admin.service.ts` với connector DTOs và endpoints.
  - Tạo hook `useAdminConnectors.ts` (query, mutation, cache invalidation).
  - Tạo `ConnectorTable.tsx`, `ConnectorPolicyDialog.tsx`, `ConnectorUsageCard.tsx`.
- [ ] G4.7 **Frontend Page & Client Feedback**:
  - Tạo `ConnectorsPage.tsx` tích hợp tìm kiếm, lọc `authType`, lọc `allowNewCredentials`, phân trang và dialog.
  - Cập nhật giao diện Designer Client: Hiển thị cảnh báo vô hiệu hóa khi người dùng xem connector bị cấm tạo mới.
- [ ] G4.8 **Kiểm thử G4**: Viết unit & integration tests cho AC-CM-01 đến AC-CM-06 (concurrency OAuth callback, package sync restart, credential gate).
