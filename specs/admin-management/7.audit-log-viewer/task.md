# Checklist: Trình tra cứu Nhật ký Quản trị (Audit Log Viewer)

Status: implemented (P1, 2026-11-24)

- [x] G7.1 **Audit Schema & Infrastructure (P0)**: Bảng `admin_audit_events` và transaction-aware audit writer đã được tạo và kích hoạt cho các sự kiện tài khoản (`USER_SUSPENDED`, `USER_REACTIVATED`, `USER_ROLE_CHANGED`, `ADMIN_BOOTSTRAPPED`).
- [x] G7.2 **Audit Atomic Rollback (P0)**: Cơ chế rollback toàn bộ transaction khi ghi audit thất bại đã được cài đặt và kiểm thử thành công.
- [x] G7.3 **Audit Action Alignment (P1)**: G4/G5 đã có writer; kiểm tra regression và bổ sung coverage PostgreSQL rollback connector.
- [x] G7.4 **Admin Audit Query Implementation (P1)**:
  - Triển khai `AdminReadPort.auditEvents()` và `AdminReadPort.auditEvent(id)` trong `PrismaAdminRead`.
  - Join thông tin actor (`name`, `email`) từ bảng `users`.
  - Phân trang server-side, sắp xếp `createdAt desc`, `id desc`.
- [x] G7.5 **Presentation Endpoints (P1)**:
  - Viết `AdminAuditFilterDto` với validation các enum action và khoảng thời gian tối đa 90 ngày.
  - Thêm endpoint `GET /api/admin/audit-events` và `GET /api/admin/audit-events/:id` trong `AdminController`.
- [x] G7.6 **Frontend Types & Service (P1)**: Cập nhật `admin.types.ts` và `admin.service.ts` với audit DTOs và API methods.
- [x] G7.7 **Frontend Components (P1)**:
  - Tạo `AuditEventFilterBar.tsx` (bộ lọc actor, action, target, thời gian).
  - Tạo `AuditEventTable.tsx` (bảng danh sách sự kiện, badges hành động, thời gian UTC/local).
  - Tạo `AuditDiffDialog.tsx` (hiển thị đối chiếu Before vs After JSON trực quan).
- [x] G7.8 **Frontend Page (P1)**: Tạo `AuditEventsPage.tsx` tích hợp bảng kiểm toán, bộ lọc, phân trang và dialog xem diff chi tiết.
- [x] G7.9 **Kiểm thử G7 (P1)**: Viết unit & integration tests cho AC-AL-01 đến AC-AL-05 (bộ lọc, join actor, diff Before/After, tính bất biến read-only).

## Bằng chứng BDD/TDD

User xác nhận triển khai ngày 2026-11-24, contract và public seams ở spec.md.

| Slice | Scenarios | Red | Green |
| --- | --- | --- | --- |
| Backend list | BDD-AL-01/02/04/09 | PostgreSQL/HTTP FAIL 404 vì endpoint chưa tồn tại | PASS, list filters/range/sort/metadata; G7 suite cuối 7 tests |
| Backend detail/privacy/auth | BDD-AL-03/05/07/11 | Detail FAIL 404 sau list Green | PASS, whitelist/legacy/unknown snapshots và auth/read-only; 17 HTTP validation tests |
| Connector rollback/no-op | BDD-AL-08/10 | Writer đã có; đây là characterization, không claim Red production | PASS: ép audit INSERT lỗi trên PostgreSQL riêng, policy/revision và audit giữ nguyên qua APIs; no-op/stale/unauthorized không thêm event |
| Frontend list/dialog/diff/lifecycle | BDD-AL-04/05/06/11/12 | Page scaffold FAIL thiếu dữ liệu; polling FAIL 2 thay vì 3 calls tại 30s và hidden mount vẫn có request | PASS: 7 UI tests + 2 hook tests; null/missing/false/0, safe diff, URL filters, errors, SYSTEM/unknown, cleanup |

Commands tại project tương ứng:

- Backend Red/Green: `node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --runTestsByPath test/integration/admin/audit-events.integration-spec.ts`.
- HTTP validation/G6 characterization: `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath test/unit/admin/admin-audit.spec.ts test/unit/admin/admin-executions.spec.ts` — 34 tests PASS.
- Frontend Red/Green: `node node_modules/vitest/vitest.mjs run --environment jsdom --maxWorkers=2 src/features/admin/pages/AuditEventsPage.test.tsx src/features/admin/hooks/useAdminAudit.test.tsx`.
- Shared visibility G6/G7: hook suites 4 tests PASS sau khi extraction useAdminPageVisibility.

## Final checks

| Check | Command / kết quả thực tế |
| --- | --- |
| Backend lint | `npm run lint:ci` — PASS; lần đầu lỗi Prettier ở test mới, đã sửa định dạng và chạy lại |
| Backend type-check | `node node_modules/typescript/bin/tsc --noEmit` — PASS |
| Backend unit regression | `node node_modules/jest/bin/jest.js --runInBand --testPathPatterns 'test/unit/(admin\|auth\|connector\|node-library)'` — 10 suites, 84 tests PASS |
| Backend integration | `node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --testPathPatterns 'test/integration/admin/'` — 4 suites, 37 tests PASS; G7 có 7 tests; database test riêng được dọn sau suite |
| Backend build | `node node_modules/@nestjs/cli/bin/nest.js build` — webpack compiled successfully; lint:ci chạy riêng để tránh prebuild lint --fix |
| Frontend lint | `npm run lint` — PASS |
| Frontend type-check | `node node_modules/typescript/bin/tsc -b` — PASS; G7 UI/hook tests và G6 visibility test cũng PASS qua cấu hình tạm extends tsconfig.app.json, include 3 files, exclude [] |
| Frontend Admin regression | `node node_modules/vitest/vitest.mjs run --environment jsdom --maxWorkers=1 src/features/admin` — 12 files, 35 tests PASS; lượt chạy đồng thời nhiều checks với 2 workers có 3 timeout, chạy lại 1 worker giữ nguyên timeout/tests đã PASS |
| Frontend build | `node node_modules/vite/bin/vite.js build` sau tsc -b — PASS; cảnh báo chunk >500kB không chặn build |
| Whitespace | `git diff --check` — PASS |

## Giới hạn và vận hành

- Bất biến ở API: chỉ GET audit events, không POST/PUT/PATCH/DELETE. Database vẫn cho phép SQL UPDATE/DELETE trực tiếp với tài khoản đủ quyền; không claim append-only hoặc chống tamper ở database.
- Không cần migration: tái sử dụng AdminAuditEvent và indexes đã có. Các writers G1/G2/G4/G5 giữ nguyên; G7 bổ sung read projection và coverage.
- User revision cũ không được suy đoán; node key ngoài state whitelist không xuất hiện trong diff. Names là metadata hiện tại, không snapshot tên lịch sử.
- Unknown action/target type hoặc state value sai kiểu bị projection an toàn; event vẫn xuất hiện với identifiers và metadata được hỗ trợ.
- List refresh mỗi 30 giây khi visible; detail fetch khi mở. HTTP request đã bắt đầu trước hidden không bị hủy chỉ vì visibility; unmount chuyển cancellation qua AbortSignal.
- Chưa benchmark query plan trên dữ liệu production lớn; lookup theo batch và pagination giới hạn 100 bản ghi.
