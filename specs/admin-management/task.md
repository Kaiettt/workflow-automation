# Checklist Triển khai Chức năng Admin (Task Breakdown)

Status: ready-for-agent

P0 (G0–G3) đã hoàn thành và nghiệm thu thực tế theo PR #39; P1 (G4–G8) sẵn sàng triển khai. Xem chi tiết: [spec](spec.md), [design](design.md), [plan](plan.md), [validation](validation.md).

---

## G0 — Thiết kế và Baseline (P0 - Đã hoàn thành)

- [x] G0.1 Viết `design.md`: DTO whitelist, schema, transaction boundary, mã lỗi và bảng traceability FR/AC.
- [x] G0.2 Chốt revision/session version, policy connector riêng và audit writer atomic.
- [x] G0.3 Rà ownership và toàn bộ đường start/enqueue/stream hiện có; giữ đường credential/OAuth trong phạm vi G4.
- [x] G0.4 Chuẩn bị fixture PostgreSQL/Redis test, ghi baseline checks hiện có.

## G1 — Role, Phiên và Nền tảng Admin (P0 - Đã hoàn thành)

- [x] G1.1 Tạo migration hai role + revision/session version + audit schema; xác minh dữ liệu mới/cũ.
- [x] G1.2 Đồng bộ auth backend/frontend/seed/test fixture; public register từ chối role.
- [x] G1.3 Kiểm tra session version trên access/refresh token; thu hồi sau commit có retry qua Redis outbox.
- [x] G1.4 Tạo audit writer và bootstrap Admin nội bộ, serialize bootstrap và có SYSTEM audit.
- [x] G1.5 Wiring Admin module, default guards (`JwtAuthGuard`, `RolesGuard`, `AdminMutationFieldsGuard`) và API validation contract.
- [x] G1.6 Thêm `AdminLayout`, navigation, route guard cho `/admin/*`, cleanup auth/cache khi phiên hết hiệu lực.
- [x] G1.7 Kiểm tra AC-01, AC-02, AC-03, AC-13 và bootstrap/legacy token.

## G2 — Quản lý Tài khoản (P0 - Đã hoàn thành)

- [x] G2.1 User list/detail/workflow summary/counts với projection whitelist và pagination.
- [x] G2.2 User active/role commands: reason, revision/no-op, transaction lock `7261101`, actor recheck, last Admin rule.
- [x] G2.3 User mutation + session version + audit atomic; rollback khi audit lỗi và retry refresh cleanup.
- [x] G2.4 Chặn owner inactive ở manual/enqueue/webhook/test trigger và schedule.
- [x] G2.5 Claim queued atomic với owner gate; CANCELLED/OWNER_SUSPENDED không gọi executor.
- [x] G2.6 Bảo toàn running execution, workflow active và không replay khi mở khóa; không overwrite CANCELLED.
- [x] G2.7 Đóng/recheck tất cả stream riêng tư khi phiên bị thu hồi trong giới hạn 30 giây (heartbeat 15s).
- [x] G2.8 `UsersPage`, `UserDetailPage` và dialog hành động, reason/tác động, error/conflict/refetch.
- [x] G2.9 Kiểm tra AC-04 đến AC-09, AC-13, AC-15 bằng HTTP/DB/runtime và concurrency thật.

## G3 — Dashboard Vận hành (P0 - Đã hoàn thành)

- [x] G3.1 Mã lỗi an toàn/cancellation reason cho execution và node; fallback lịch sử không lộ raw message.
- [x] G3.2 Aggregate API: account/workflow snapshot, execution status/rate/trend/error groups trong transaction Repeatable Read.
- [x] G3.3 Timezone, khoảng `[from, to)`, range validation tối đa 90 ngày và pagination/index.
- [x] G3.4 `DashboardPage`, filter nhanh 24h/7d/30d, chart, query keys, visible-only polling, empty/error/retry.
- [x] G3.5 Kiểm tra AC-12, AC-14, AC-15, AC-16, AC-17.

---

## G4 — Quản lý Connector & Chính sách Credential (P1 Mới)

- [ ] G4.1 **Database Migration**: Tạo bảng `connector_policies` (`connector_id` PK FK, `allow_new_credentials`, `revision`, `updated_at`) trong `monolith-backend/prisma/schema.prisma`.
- [ ] G4.2 **Catalog Sync Protection**: Sửa `PackageCatalogSync` (`monolith-backend/libs/node-library/src/infrastructure/package-catalog.sync.ts`) để chỉ upsert bảng `connectors`, không chạm vào bảng `connector_policies`.
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
- [ ] G4.8 **Kiểm thử G4**: Viết unit & integration tests cho AC-10, AC-11, AC-18, AC-19 (concurrency OAuth callback, package sync restart, credential gate).

---

## G5 — Quản lý Loại Node - Node Types (P1)

Đã triển khai. Xem [BDD, bằng chứng kiểm tra và giới hạn](5.node-type-management/task.md).

- [x] G5.1 **Database Migration**: Tạo bảng `node_type_policies` (`node_type_key` PK FK, `is_catalog_visible`, `is_execution_allowed`, `revision`, `updated_at`).
- [x] G5.2 **Catalog Sync Protection**: Giữ nguyên sync metadata và kiểm chứng bằng PostgreSQL thật rằng `node_type_policies` không bị ghi đè.
- [x] G5.3 **Node Type Policy Port & Command**:
  - Tạo `ChangeNodeTypeStatusCommand` trong `libs/node-library/src/application/commands/`.
  - Triển khai handler: Lấy advisory lock `7261103`, kiểm tra `expectedRevision`, no-op, cập nhật cờ, tăng revision và ghi `admin_audit_events` (`NODE_TYPE_STATUS_CHANGED`) atomic.
- [x] G5.4 **Designer Palette Filter Gate**:
  - Cập nhật `NodeTypesController.getNodeTypes()` kết hợp truy vấn `node_type_policies` để lọc bỏ các node có `isCatalogVisible === false`.
- [x] G5.5 **Runtime Execution Enforcement Gate**:
  - Cập nhật `NodeRunner.run()` trong `monolith-backend/libs/execution/src/application/services/node-runner.ts`.
  - Nếu `isExecutionAllowed === false`: Dừng thực thi node, ghi nhận log `FAILED` với mã lỗi `NODE_TYPE_DISABLED`.
- [x] G5.6 **Admin Projection & Query**:
  - Bổ sung `AdminReadPort.nodeTypes()` và `AdminReadPort.nodeType(key)` tính toán `publishedWorkflowCount` và `draftWorkflowCount`.
  - Thêm endpoint `GET /api/admin/node-types`, `GET /api/admin/node-types/:key`, `PATCH /api/admin/node-types/:key/status` trong `AdminController`.
- [x] G5.7 **Frontend Components & Page**:
  - Cập nhật `admin.types.ts` và `admin.service.ts` với node type DTOs và API methods.
  - Tạo hook `useAdminNodeTypes.ts`.
  - Tạo `NodeTypeTable.tsx`, `NodeTypeStatusDialog.tsx`, `NodeTypeDetailCard.tsx`.
  - Tạo `NodeTypesPage.tsx` có bộ lọc category, tìm kiếm, phân trang và dialog điều chỉnh trạng thái.
- [x] G5.8 **Kiểm thử G5**: Viết unit & integration tests cho AC-20, AC-21, AC-22, AC-23 (palette visibility, runtime execution blocked, workflow backward compatibility).

---

## G6 — Giám sát Execution Toàn Nền Tảng (P1 Mới)

- [x] G6.1 **Database Indexing**: Giữ workflow index; thêm global queued_at/id và status/queued_at/id theo G6 design.
- [x] G6.2 **Admin Execution Projection (Safe Whitelist)**:
  - Triển khai `AdminReadPort.executions()` và `AdminReadPort.execution(id)`.
  - Triển khai `select` tĩnh chỉ lấy metadata an toàn: `id`, `workflowId`, `workflowName`, `ownerId`, `ownerName`, `ownerEmail`, `versionNumber`, `triggerType`, `status`, `queuedAt`, `startedAt`, `finishedAt`, `durationMs`, `errorCode`, `cancellationReason`.
  - Triển khai `nodeLogs` an toàn: `nodeId`, `nodeKey`, `status`, `startedAt`, `finishedAt`, `durationMs`, `retryCount`, `errorCode`.
  - **Bảo mật**: Tuyệt đối không chọn `input`, `output`, `context`, `errorMessage`, `errorStack`, hay node custom label.
- [x] G6.3 **Presentation Endpoints**: Thêm `GET /api/admin/executions` và `GET /api/admin/executions/:id` trong `AdminController` có validation pipe bộ lọc và khoảng thời gian.
- [x] G6.4 **Frontend Service & Types**: Cập nhật `admin.types.ts` và `admin.service.ts` với `executions()` và `execution()`.
- [x] G6.5 **Visible Polling Hook**: Tạo hook `useAdminExecutions.ts` tự động polling mỗi 30 giây khi trang hiển thị, dừng khi tab bị ẩn.
- [x] G6.6 **Frontend Components**:
  - Tạo `ExecutionFilterBar.tsx` (bộ lọc owner, workflow, execution ID, status, trigger, time range).
  - Tạo `ExecutionTable.tsx` (danh sách execution, badges trạng thái, timing, nút xem chi tiết).
  - Tạo `NodeLogsTimeline.tsx` (bảng tiến trình node, timing, safe error code; không payload).
- [x] G6.7 **Frontend Pages**:
  - Tạo `ExecutionsPage.tsx` (danh sách và bộ lọc).
  - Tạo `ExecutionDetailPage.tsx` (thông tin chi tiết execution và bảng node execution logs).
  - Đảm bảo giao diện 100% Read-only (không có nút Run, Retry, Cancel hay link mở canvas của Client).
- [x] G6.8 **Kiểm thử G6**: Viết unit & integration tests cho AC-12, AC-24, AC-25, AC-26 (kiểm tra không rò rỉ secret/prompt/payload, kiểm tra bộ lọc, phân trang và null semantics). Bằng chứng và giới hạn: [G6 task](6.execution-monitoring/task.md).

---

## G7 — Trình tra cứu Nhật ký Quản trị - Audit Log Viewer (P1 Mới)

- [x] G7.1 **Audit Action Alignment**: Writers hiện có cho sáu action; projection whitelist tương thích dữ liệu cũ và coverage rollback/no-op. Bằng chứng: [G7 task](7.audit-log-viewer/task.md).
- [x] G7.2 **Admin Audit Query Implementation**:
  - Triển khai `AdminReadPort.auditEvents()` và `AdminReadPort.auditEvent(id)` có join thông tin actor (`name`, `email`) và target.
  - Hỗ trợ lọc theo `actorId`, `actorType`, `action`, `targetType`, `targetId`, `from`, `to`. Sắp xếp giảm dần (`createdAt desc`, `id desc`).
- [x] G7.3 **Presentation Endpoints**: Thêm `GET /api/admin/audit-events` và `GET /api/admin/audit-events/:id` trong `AdminController`.
- [x] G7.4 **Frontend Service & Types**: Cập nhật `admin.types.ts` và `admin.service.ts` với audit DTOs và methods.
- [x] G7.5 **Frontend Components**:
  - Tạo `AuditEventFilterBar.tsx` (bộ lọc actor, action, target, thời gian).
  - Tạo `AuditEventTable.tsx` (danh sách sự kiện, badges hành động, thời gian UTC/local).
  - Tạo `AuditDiffDialog.tsx` (hiển thị đối chiếu Before vs After JSON theo định dạng trực quan).
- [x] G7.6 **Frontend Page**: Tạo `AuditEventsPage.tsx` tích hợp bảng kiểm toán, bộ lọc, phân trang và dialog xem diff chi tiết.
- [x] G7.7 **Kiểm thử G7**: API chỉ đọc, projection/diff, auth, lifecycle và atomic rollback đã kiểm tra; phạm vi database immutability và bằng chứng ở [G7 task](7.audit-log-viewer/task.md).

---

## G8 — Nghiệm thu Tổng thể và Rollout (P1 Mới)

- [ ] G8.1 **Cập nhật Điều hướng AdminLayout**:
  - Cập nhật `AdminLayout.tsx` bổ sung đầy đủ các menu tabs: `Overview` (`/admin`), `Users` (`/admin/users`), `Connectors` (`/admin/connectors`), `Node Types` (`/admin/node-types`), `Executions` (`/admin/executions`), `Audit Logs` (`/admin/audit-events`).
- [ ] G8.2 **Kiểm thử Tích hợp Toàn diện (AC-01 đến AC-28)**:
  - Chạy toàn bộ 28 Acceptance Criteria qua HTTP và PostgreSQL/Redis test container.
- [ ] G8.3 **Kiểm thử Bộ Suite Tiêu chuẩn**:
  - Backend: `npm test -- --runInBand`, `npm run test:integration`, `npm run lint`, `npm run build`.
  - Frontend: `npm test`, `npm run lint`, `npm run build`.
- [ ] G8.4 **Rehearsal Migration**: Thực hiện rehearsal migration `20261116000000_admin_p1` trên database test có dữ liệu cũ và dữ liệu mới.
- [ ] G8.5 **Tài liệu Hướng dẫn Vận hành**: Cập nhật `operations.md` hướng dẫn migration, vận hành connector policy, node type toggles, execution inspection và audit verification.
- [ ] G8.6 **Nghiệm thu & Bàn giao**: Cập nhật spec/PRD/SRS, đóng spec và bàn giao tính năng hoàn chỉnh.
