# Kế hoạch Triển khai Chức năng Admin (Implementation Plan)

Status: ready-for-agent

Tiến độ: Giai đoạn P0 (G0–G3) đã hoàn thành và nghiệm thu thực tế theo PR #39. Tài liệu này cập nhật chi tiết kế hoạch thực hiện cho toàn bộ các giai đoạn còn lại thuộc P1 (G4–G8). Xem [thiết kế kiến trúc](design.md), [đặc tả yêu cầu](spec.md), [checklist công việc](task.md) và [kịch bản kiểm thử](validation.md).

---

## 1. Lộ trình và Các Mốc Bàn giao (Milestones)

| Giai đoạn | Trọng tâm | Trạng thái | Đầu ra chính | Phụ thuộc |
| --- | --- | --- | --- | --- |
| **G0: Thiết kế và Baseline** | Chuẩn bị | Đã hoàn thành | DTO whitelist, schema, transaction boundary, kiểm thử baseline | Không |
| **G1: Role, Phiên & Nền tảng** | P0 | Đã hoàn thành | 2 role `CLIENT`/`ADMIN`, session validity, audit writer, bootstrap, AdminLayout | G0 |
| **G2: Quản lý Tài khoản** | P0 | Đã hoàn thành | API/UI User list/detail, lock/unlock, đổi role, owner cancellation gate | G1 |
| **G3: Dashboard Vận hành** | P0 | Đã hoàn thành | Aggregate API, tỷ lệ thành công, xu hướng ngày, nhóm lỗi an toàn, DashboardPage | G1 |
| **G4: Quản lý Connector** | P1 | Sẵn sàng triển khai | Bảng `connector_policies`, `allowNewCredentials`, chặn OAuth/API-key race condition, ConnectorsPage | G1 |
| **G5: Quản lý Loại Node** | P1 | Sẵn sàng triển khai | Bảng `node_type_policies`, `isCatalogVisible` & `isExecutionAllowed`, NodeRunner gate, NodeTypesPage | G1 |
| **G6: Giám sát Execution** | P1 | Sẵn sàng triển khai | Projection an toàn, bộ lọc đa chiều, ExecutionsPage, ExecutionDetailPage, visible polling | G1, G3 |
| **G7: Trình tra cứu Audit** | P1 | Sẵn sàng triển khai | API tra cứu audit events, AuditEventsPage, dialog diff Before/After whitelist, audit connector/node | G1, G4, G5 |
| **G8: Nghiệm thu & Rollout** | Hoàn tất MVP | Sẵn sàng triển khai | Chạy toàn bộ AC-01 đến AC-28, migration rehearsal, smoke test, tài liệu bàn giao | G4, G5, G6, G7 |

*Mối quan hệ phụ thuộc*: G4 và G5 có thể được triển khai độc lập hoặc song song vì tác động lên hai domain riêng biệt (`Connector` và `NodeLibrary`). G6 phụ thuộc vào model `Execution` và `ExecutionNodeLog` đã có. G7 hiển thị nhật ký phát sinh từ G1, G2, G4, G5. G8 là bước kiểm chứng tích hợp toàn diện trước khi bàn giao.

---

## 2. G4: Quản lý Connector (P1)

### 2.1. Mục tiêu
Cho phép Admin kiểm soát việc cấp kết nối dịch vụ mới thông qua cờ `allowNewCredentials`, bảo toàn toàn bộ kết nối và workflow hiện có, chống race condition ở luồng OAuth và không bị ghi đè khi khởi động lại server.

### 2.2. Nhiệm vụ Backend & Cơ sở Dữ liệu
1. **Migration Schema**: Tạo bảng `connector_policies(connector_id PK FK, allow_new_credentials, revision, updated_at)`.
2. **Catalog Sync Isolation**: Cập nhật `PackageCatalogSync` để chỉ upsert vào bảng `connectors`, không chạm vào bảng `connector_policies`.
3. **Connector Administration Port & Command**:
   - Định nghĩa `ConnectorPolicyPort` và command `ChangeConnectorPolicyCommand`.
   - Lấy advisory lock `7261102`, kiểm tra `expectedRevision`, cập nhật chính sách, tăng revision và ghi `admin_audit_events` với action `CONNECTOR_POLICY_CHANGED` trong cùng transaction.
4. **Policy Enforcement Gates**:
   - API Key: Kiểm tra `allowNewCredentials` trong `CreateApiKeyCredentialCommand`.
   - Google OAuth: Kiểm tra tại `GetGoogleAuthUrlQuery` và kiểm tra lại bắt buộc với lock trong transaction tại `HandleGoogleCallbackCommand`.
   - Package OAuth2: Kiểm tra tại `OAuth2Controller.auth` và kiểm tra lại bắt buộc trong transaction tại `OAuth2Service.complete`.
   - Từ chối với mã lỗi `409 Conflict` (`CONNECTOR_NEW_CREDENTIALS_DISABLED`) khi bị chặn.
5. **Projection Query**: Bổ sung `AdminReadPort.connectors()` và `.connector(id)` tính toán `credentialCount` và `workflowCount` (distinct published workflows).

### 2.3. Nhiệm vụ Frontend
1. Mở rộng `admin.types.ts` và `admin.service.ts` với các hàm `connectors()`, `connector()`, `changeConnectorPolicy()`.
2. Tạo hook `useAdminConnectors.ts` (list, detail, mutation).
3. Tạo các components: `ConnectorTable.tsx`, `ConnectorPolicyDialog.tsx`, `ConnectorUsageCard.tsx`.
4. Tạo trang `ConnectorsPage.tsx` tích hợp tìm kiếm, lọc authType, lọc trạng thái, phân trang và dialog đổi chính sách.
5. Cập nhật giao diện Designer Client: Hiển thị badge hoặc thông báo rõ ràng "New connections disabled by administrator" khi connector bị cấm tạo mới.

### 2.4. Tiêu chí hoàn thành G4
- Đạt tiêu chí AC-10, AC-11, AC-18, AC-19.
- Thử nghiệm tạo credential đồng thời với lệnh khóa policy: request đến sau khi policy commit bị chặn chính xác.
- Khởi động lại server (`PackageCatalogSync`) không làm thay đổi giá trị `allowNewCredentials` đã lưu.

---

## 3. G5: Quản lý Loại Node - Node Types (P1)

### 3.1. Mục tiêu
Cung cấp khả năng kiểm soát danh mục khối chức năng cho Admin, phân tách rõ ràng giữa việc ẩn khỏi palette (`isCatalogVisible`) và cấm thực thi ở runtime (`isExecutionAllowed`) nhằm bảo vệ tính toàn vẹn của các workflow hiện hữu.

### 3.2. Nhiệm vụ Backend & Cơ sở Dữ liệu
1. **Migration Schema**: Tạo bảng `node_type_policies(node_type_key PK FK, is_catalog_visible, is_execution_allowed, revision, updated_at)`.
2. **Catalog Sync Isolation**: Cập nhật `PackageCatalogSync` để chỉ upsert metadata vào `node_type_definitions`, không ghi đè cờ trong `node_type_policies`.
3. **Node Type Administration Port & Command**:
   - Định nghĩa `NodeTypePolicyPort` và command `ChangeNodeTypeStatusCommand`.
   - Lấy advisory lock `7261103`, kiểm tra `expectedRevision`, cập nhật chính sách, tăng revision và ghi `admin_audit_events` với action `NODE_TYPE_STATUS_CHANGED` trong cùng transaction.
4. **Palette Filtering Gate**: Cập nhật `NodeTypesController.getNodeTypes()` để chỉ trả về các node có `isCatalogVisible === true` (kết hợp left join `node_type_policies`).
5. **Runtime Execution Gate**:
   - Tích hợp kiểm tra trong `NodeRunner.run()`.
   - Nếu `isExecutionAllowed === false`: Chặn gọi executor, ghi nhận `ExecutionNodeLog` với `status: FAILED`, `errorCode: NODE_TYPE_DISABLED`, kết thúc lượt chạy an toàn.
6. **Projection Query**: Bổ sung `AdminReadPort.nodeTypes()` và `.nodeType(key)` tính toán số workflow sử dụng (`publishedWorkflowCount`, `draftWorkflowCount`).

### 3.3. Nhiệm vụ Frontend
1. Mở rộng `admin.types.ts` và `admin.service.ts` với `nodeTypes()`, `nodeType()`, `changeNodeTypeStatus()`.
2. Tạo hook `useAdminNodeTypes.ts`.
3. Tạo các components: `NodeTypeTable.tsx`, `NodeTypeStatusDialog.tsx`, `NodeTypeDetailCard.tsx`.
4. Tạo trang `NodeTypesPage.tsx` hỗ trợ tìm kiếm, lọc category, lọc trạng thái, phân trang và dialog điều chỉnh trạng thái.

### 3.4. Tiêu chí hoàn thành G5
- Đạt tiêu chí AC-20, AC-21, AC-22, AC-23.
- Khi ẩn node khỏi catalog: Palette của Designer không còn hiển thị node, nhưng workflow cũ chứa node đó vẫn mở và chạy bình thường.
- Khi cấm thực thi node: Workflow đang chạy gặp node đó dừng với mã lỗi `NODE_TYPE_DISABLED`.

---

## 4. G6: Giám sát Execution Toàn Nền Tảng (P1)

### 4.1. Mục tiêu
Cung cấp khả năng theo dõi tình hình thực thi workflow toàn hệ thống, hỗ trợ tra cứu sự cố kỹ thuật nhưng tuân thủ nghiêm ngặt nguyên tắc bảo mật và quyền riêng tư (không lộ payload/secrets của Client).

### 4.2. Nhiệm vụ Backend & Cơ sở Dữ liệu
1. **Đánh chỉ mục Tối ưu**:
   - Giữ workflow/queued_at/id index; bổ sung global queued_at/id và status/queued_at/id theo [G6 design](6.execution-monitoring/design.md).
2. **Admin Execution Projection**:
   - Triển khai `AdminReadPort.executions()` hỗ trợ bộ lọc: `ownerId`, `workflowId`, `executionId`, `status`, `triggerType`, thời gian `[from, to)`.
   - Triển khai `AdminReadPort.execution(id)` lấy thông tin tổng quan và danh sách `nodeLogs` an toàn.
   - **Bảo mật Whitelist tuyệt đối**: Chỉ `SELECT` các cột whitelist (`id`, `workflowId`, `status`, `queuedAt`, `startedAt`, `finishedAt`, `durationMs`, `errorCode`, `cancellationReason`, v.v.). Tuyệt đối không đọc `input`, `output`, `context`, `errorMessage`, `errorStack`.
   - Xử lý mã lỗi an toàn: Lỗi chưa phân loại trả về `UNCLASSIFIED_ERROR`.
3. **Presentation Controller**: Thêm endpoint `GET /api/admin/executions` và `GET /api/admin/executions/:id`.

### 4.3. Nhiệm vụ Frontend
1. Mở rộng `admin.types.ts` và `admin.service.ts` với `executions()` và `execution()`.
2. Tạo hook `useAdminExecutions.ts` tích hợp cơ chế visible-only polling (30 giây).
3. Tạo các components: `ExecutionFilterBar.tsx`, `ExecutionTable.tsx`, `NodeLogsTimeline.tsx`.
4. Tạo trang `ExecutionsPage.tsx` và `ExecutionDetailPage.tsx`.
5. Đảm bảo giao diện hoàn toàn chỉ đọc (không có nút Run, Retry, Cancel hay link mở canvas của Client).

### 4.4. Tiêu chí hoàn thành G6
- Đạt tiêu chí AC-12, AC-24, AC-25, AC-26.
- Kiểm thử dữ liệu giả định chứa email, mật khẩu, API key, prompt trong input/output/errorStack: Response của Admin API chứng minh không chứa bất kỳ chuỗi nhạy cảm nào.

---

## 5. G7: Trình tra cứu Nhật ký Quản trị - Audit Log Viewer (P1)

### 5.1. Mục tiêu
Cung cấp giao diện tra cứu lịch sử kiểm toán toàn diện, minh bạch và bất biến đối với toàn bộ các thay đổi quản trị trên nền tảng.

### 5.2. Nhiệm vụ Backend & Cơ sở Dữ liệu
1. **Audit Event Enrichment**:
   - Đảm bảo toàn bộ các actions (`USER_SUSPENDED`, `USER_REACTIVATED`, `USER_ROLE_CHANGED`, `ADMIN_BOOTSTRAPPED`, `CONNECTOR_POLICY_CHANGED`, `NODE_TYPE_STATUS_CHANGED`) ghi nhận đúng format và whitelist fields.
2. **Admin Audit Query Implementation**:
   - Triển khai `AdminReadPort.auditEvents()` hỗ trợ lọc: `actorId`, `actorType`, `action`, `targetType`, `targetId`, `from`, `to`.
   - Triển khai `AdminReadPort.auditEvent(id)` trả về chi tiết kèm thông tin actor (join bảng users) và target.
   - Phân trang server-side, sắp xếp `createdAt desc`, `id desc`.
3. **Presentation Controller**: Thêm `GET /api/admin/audit-events` và `GET /api/admin/audit-events/:id`.

### 5.3. Nhiệm vụ Frontend
1. Mở rộng `admin.types.ts` và `admin.service.ts` với `auditEvents()` và `auditEvent()`.
2. Tạo hook `useAdminAudit.ts`.
3. Tạo các components: `AuditEventFilterBar.tsx`, `AuditEventTable.tsx`, `AuditDiffDialog.tsx`.
4. Tạo trang `AuditEventsPage.tsx` hiển thị danh sách kiểm toán, badges hành động và dialog xem diff Before vs After.

### 5.4. Tiêu chí hoàn thành G7
- Đạt tiêu chí AC-09, AC-27, AC-28.
- Toàn bộ các thao tác mutation ở G1, G2, G4, G5 đều hiển thị đầy đủ, chính xác diff trên giao diện.

---

## 6. G8: Nghiệm thu Tổng thể và Rollout (P1)

### 6.1. Kiểm thử Toàn diện (End-to-End Verification)
- Chạy toàn bộ 28 Acceptance Criteria (AC-01 đến AC-28) trên môi trường test tích hợp (PostgreSQL và Redis thật).
- Chạy bộ kiểm thử tự động của repo:
  - Backend: `npm test -- --runInBand`, `npm run test:integration`, `npm run lint`, `npm run build`.
  - Frontend: `npm test`, `npm run lint`, `npm run build`.

### 6.2. Rehearsal Migration & Đồng bộ Dữ liệu
1. Khởi tạo database test từ snapshot hiện tại.
2. Chạy migration `20261116000000_admin_p1`.
3. Xác minh tính toàn vẹn: Các connector và node type hiện có tự động mang giá trị policy mặc định (`true`) mà không cần can thiệp thủ công.
4. Chạy `PackageCatalogSync` và Database Seed: Kiểm tra các cờ chính sách của Admin không bị ghi đè.

### 6.3. Quy trình Triển khai Production (Rollout Sequence)
1. **Thông báo bảo trì**: Thông báo lịch cập nhật hệ thống.
2. **Deploy Backend & Database Migration**:
   - Chạy `prisma migrate deploy` để áp dụng bảng mới `connector_policies` và `node_type_policies`.
   - Khởi động phiên bản backend mới (API và Worker).
3. **Deploy Frontend**: Cập nhật bản build frontend mới có đầy đủ 7 menu Admin.
4. **Smoke Test**: Đăng nhập bằng tài khoản Admin, kiểm tra lần lượt 6 trang chức năng và 1 trang dashboard.
