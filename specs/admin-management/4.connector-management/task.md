# Danh sách Nhiệm vụ TDD: Quản lý Connector và Chính sách Credential

Status: completed (P1)

Tuân thủ quy trình **TDD (Red → Green → Refactor)** và **BDD Scenarios** từ [spec.md](./spec.md). Mỗi nhiệm vụ bắt buộc phải viết test thất bại (RED) trước khi triển khai code (GREEN).

---

## Bảng Đối chiếu Ma trận BDD & TDD (Traceability Matrix)

| BDD Scenario | Tiêu chí AC | Lát cắt TDD | File Test |
| :--- | :--- | :--- | :--- |
| **BDD-CM-01** (Danh sách, Counts, Filter) | AC-CM-01 | Slice 5, 6 | `admin-connectors.spec.ts` |
| **BDD-CM-02** (Đổi Policy thành công) | AC-CM-02, AC-CM-06 | Slice 1, 6 | `change-connector-policy.handler.spec.ts`, `admin-connectors.spec.ts`, `ConnectorPolicyDialog.test.tsx` |
| **BDD-CM-03** (Stale Revision 409) | AC-CM-06 | Slice 1, 6 | `change-connector-policy.handler.spec.ts`, `ConnectorPolicyDialog.test.tsx` |
| **BDD-CM-04** (Xử lý No-op) | AC-CM-06 | Slice 1 | `change-connector-policy.handler.spec.ts` |
| **BDD-CM-05** (Chặn API Key Credential) | AC-CM-02 | Slice 3 | `credentials.handlers.spec.ts` |
| **BDD-CM-06** (Chặn Google Auth URL) | AC-CM-02 | Slice 3 | `oauth2.service.spec.ts`, `google-oauth.service.ts` |
| **BDD-CM-07** (Bảo toàn Credential cũ & Refresh) | AC-CM-03 | Slice 3 | `credentials.handlers.spec.ts`, `oauth2.service.spec.ts` |
| **BDD-CM-08** (Race condition OAuth Callback) | AC-CM-04 | Slice 4 | `oauth2.service.spec.ts`, `google-oauth.service.ts` |
| **BDD-CM-09** (Đồng bộ Catalog không đè Policy) | AC-CM-05 | Slice 2 | `package-catalog-sync.spec.ts` |
| **BDD-CM-10** (Cảnh báo Designer UI) | AC-CM-02 | Slice 7 | `ConnectorDisabledBanner.test.tsx`, `ConnectorPolicyDialog.test.tsx` |

---

## Chi tiết Nhiệm vụ Triển khai theo Lát cắt (Vertical Slices)

### Slice 0: Hạ tầng Kiểm thử & Database Schema
- [x] **G4.0.1 [RED - Test]**: Viết integration test kiểm tra bảng `connector_policies` tồn tại, liên kết cascade với bảng `connectors`.
- [x] **G4.0.2 [GREEN - Code]**: Khai báo model `ConnectorPolicy` trong `monolith-backend/prisma/schema.prisma` và tạo migration `20261116000000_admin_connector_policy`.
- [x] **G4.0.3 [GREEN - Code]**: Tạo `InMemoryConnectorPolicyRepository` trong `monolith-backend/test/support/connector/in-memory-connector-policy.repository.ts` tuân thủ `ConnectorPolicyPort`.
- [x] **G4.0.4 [VERIFY]**: Chạy `prisma generate` và xác nhận test schema PASS.

### Slice 1: Lệnh Thay đổi Chính sách (`ChangeConnectorPolicyCommand`)
- [x] **G4.1.1 [RED - Test]**: Viết unit test cho `ChangeConnectorPolicyHandler` (`test/unit/connector/commands/change-connector-policy.handler.spec.ts`):
  - Kiểm tra đổi chính sách thành công, tăng revision và phát sinh sự kiện kiểm toán `CONNECTOR_POLICY_CHANGED` (BDD-CM-02).
  - Kiểm tra ném `ConflictException('STALE_REVISION')` khi revision không khớp (BDD-CM-03).
  - Kiểm tra xử lý No-op: Không tăng revision và không ghi audit event khi giá trị không đổi (BDD-CM-04).
  - Kiểm tra giá trị mặc định là `allowNewCredentials = true` khi chưa có bản ghi (BDD-CM-02).
- [x] **G4.1.2 [GREEN - Code]**: Triển khai `ChangeConnectorPolicyCommand`, `ChangeConnectorPolicyHandler`, và port `ConnectorPolicyPort` trong `libs/connector/src/application/`.
- [x] **G4.1.3 [VERIFY]**: Chạy unit test suite của module connector và xác nhận 100% tests PASS.

### Slice 2: Cô lập Đồng bộ Catalog (`PackageCatalogSync`)
- [x] **G4.2.1 [RED - Test]**: Viết isolation unit test (`test/unit/node-library/infrastructure/package-catalog-sync.spec.ts`):
  - Chạy `PackageCatalogSync.sync()`.
  - Assert chỉ upsert `connectors` và `nodeTypeDefinitions`, `connector_policies` hoàn toàn không bị chạm vào (BDD-CM-09).
- [x] **G4.2.2 [GREEN - Code]**: Xác nhận `monolith-backend/libs/node-library/src/infrastructure/package-catalog.sync.ts` chỉ upsert bảng `connectors`.
- [x] **G4.2.3 [VERIFY]**: Chạy test `package-catalog-sync.spec.ts` xác nhận PASS.

### Slice 3: Chặn Tạo Credential khi Chính sách Bị Tắt (Credential Gates)
- [x] **G4.3.1 [RED - Test]**: Viết unit test cho `CreateApiKeyCredentialHandler` (`test/unit/connector/application/credentials.handlers.spec.ts`):
  - Thất bại với `CONNECTOR_NEW_CREDENTIALS_DISABLED` khi `allowNewCredentials = false` (BDD-CM-05).
- [x] **G4.3.2 [GREEN - Code]**: Gắn cờ kiểm tra `assertCanCreateCredential` vào `CreateApiKeyCredentialHandler`.
- [x] **G4.3.3 [RED - Test]**: Viết unit test cho OAuth2 authorization URL trong `oauth2.service.spec.ts`:
  - Thất bại với `CONNECTOR_NEW_CREDENTIALS_DISABLED` khi `allowNewCredentials = false` (BDD-CM-06).
- [x] **G4.3.4 [GREEN - Code]**: Gắn gate kiểm tra vào `GoogleOauthService.getAuthUrl` và `OAuth2Service.authorizationUrl`.
- [x] **G4.3.5 [RED - Test]**: Kiểm tra bảo toàn credential cũ:
  - Xác nhận credential cũ vẫn giải mã, chọn trong workflow và chạy bình thường khi policy = false (BDD-CM-07).
- [x] **G4.3.6 [GREEN - Code]**: Đảm bảo các luồng query credential và refresh worker không phụ thuộc vào `allowNewCredentials`.
- [x] **G4.3.7 [VERIFY]**: Chạy toàn bộ test suites của credential gates và xác nhận PASS.

### Slice 4: Chống Race Condition tại Callback Hoàn tất OAuth
- [x] **G4.4.1 [RED - Test]**: Viết unit test race condition flow trong `oauth2.service.spec.ts`:
  - Admin tắt policy sau khi authUrl được tạo.
  - Assert `complete` thất bại với `CONNECTOR_NEW_CREDENTIALS_DISABLED` (BDD-CM-08).
- [x] **G4.4.2 [GREEN - Code]**: Thêm transaction locking và re-check policy trong `GoogleOauthService.handleCallback` và `OAuth2Service.complete`.
- [x] **G4.4.3 [VERIFY]**: Chạy test xác nhận PASS 100%.

### Slice 5: Projection Danh mục Connector và Thống kê Sử dụng
- [x] **G4.5.1 [RED - Test]**: Viết unit test cho Admin Controller & Query projection (`test/unit/admin/admin-connectors.spec.ts`):
  - Kiểm tra trả về danh sách connector với `credentialCount` và `workflowCount` (distinct published workflows) (BDD-CM-01).
  - Kiểm tra lọc `authType`, `isActive`, `allowNewCredentials` và tìm kiếm `q` (BDD-CM-01).
- [x] **G4.5.2 [GREEN - Code]**: Mở rộng `AdminReadPort` và triển khai trong `PrismaAdminRead`.
- [x] **G4.5.3 [VERIFY]**: Chạy unit test projection xác nhận PASS.

### Slice 6: Presentation Controller & DTO Validation
- [x] **G4.6.1 [RED - Test]**: Viết test cho Admin Controller (`test/unit/admin/admin-connectors.spec.ts`):
  - `GET /api/admin/connectors` -> HTTP 200, sanitized fields (BDD-CM-01).
  - `PATCH /api/admin/connectors/:id/credential-policy` -> Validation body, guard chặn field lạ.
  - `PATCH /api/admin/connectors/:id/credential-policy` -> Dispatches `ChangeConnectorPolicyCommand` (BDD-CM-02).
- [x] **G4.6.2 [GREEN - Code]**:
  - Tạo `ChangeConnectorPolicyDto` và `ConnectorsDto` với validation annotations.
  - Thêm endpoints `GET /api/admin/connectors`, `GET /api/admin/connectors/:id`, `PATCH /api/admin/connectors/:id/credential-policy` trong `AdminController`.
- [x] **G4.6.3 [VERIFY]**: Chạy test suite `admin-connectors.spec.ts` xác nhận PASS.

### Slice 7: Frontend UI & Client Feedback
- [x] **G4.7.1 [RED - Test]**: Viết test cho hook `useAdminConnectors.test.tsx` (`frontend/src/features/admin/hooks/useAdminConnectors.test.tsx`).
- [x] **G4.7.2 [GREEN - Code]**: Cài đặt hook `useAdminConnectors` với React Query cache invalidation.
- [x] **G4.7.3 [RED - Test]**: Viết RTL test cho `ConnectorPolicyDialog.test.tsx`:
  - Kiểm tra mở modal, nhập lý do, submit, xử lý lỗi xung đột 409 (BDD-CM-02, BDD-CM-03).
- [x] **G4.7.4 [GREEN - Code]**: Xây dựng `ConnectorTable.tsx`, `ConnectorPolicyDialog.tsx`, `ConnectorsPage.tsx` bằng `shadcn/ui`.
- [x] **G4.7.5 [RED - Test]**: Viết test cho `ConnectorDisabledBanner.test.tsx`:
  - Hiển thị cảnh báo khi connector bị tắt tạo mới (BDD-CM-10).
- [x] **G4.7.6 [GREEN - Code]**: Tích hợp `ConnectorDisabledBanner` vào `CredentialField.tsx` trong Designer Client.
- [x] **G4.7.7 [VERIFY]**: Chạy `npx vitest run ...` trong `frontend/` và kiểm tra 100% UI tests PASS.
