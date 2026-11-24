# Checklist: Giám sát Execution Toàn Nền Tảng (Execution Monitoring)

Status: implemented (P1, 2026-11-24)

- [x] G6.1 **Database Indexing**: Giữ workflow index; thêm global queued_at/id và status/queued_at/id; kiểm tra migration trên PostgreSQL riêng.
- [x] G6.2 **Admin Execution Projection**:
  - Triển khai `AdminReadPort.executions()` và `AdminReadPort.execution(id)` trong `PrismaAdminRead`.
  - Cài đặt `select` tĩnh theo whitelist an toàn: Tuyệt đối không chọn `input`, `output`, `context`, `errorMessage`, `errorStack`, custom node label.
  - Chuẩn hóa mã lỗi an toàn fallback `UNCLASSIFIED_ERROR`.
- [x] G6.3 **Presentation Endpoints**:
  - Viết `AdminExecutionFilterDto` với validation phân trang và khoảng thời gian tối đa 90 ngày.
  - Thêm endpoint `GET /api/admin/executions` và `GET /api/admin/executions/:id` trong `AdminController`.
- [x] G6.4 **Frontend Types & Service**: Cập nhật `admin.types.ts` và `admin.service.ts` với execution DTOs và API methods.
- [x] G6.5 **Visible Polling Hook**: Xây dựng hook `useAdminExecutions.ts` tự động refetch mỗi 30 giây khi tab hiển thị, dừng khi tab bị ẩn.
- [x] G6.6 **Frontend Components**:
  - Tạo `ExecutionFilterBar.tsx` (bộ lọc owner, workflow, execution ID, status, trigger, time range).
  - Tạo `ExecutionTable.tsx` (bảng danh sách, badges, timing, mã lỗi).
  - Tạo `NodeLogsTimeline.tsx` (tiến trình các node log an toàn).
- [x] G6.7 **Frontend Pages**:
  - Tạo `ExecutionsPage.tsx` và `ExecutionDetailPage.tsx`.
  - Đảm bảo giao diện hoàn toàn chỉ đọc (không có nút Run, Retry, Cancel).
- [x] G6.8 **Kiểm thử G6**: Viết unit & integration tests cho AC-EM-01 đến AC-EM-05 (bộ lọc đa chiều, assertion không rò rỉ secret/prompt/payload, null semantics, visible polling).

## Bằng chứng BDD/TDD

User xác nhận triển khai ngày 2026-11-24; scenarios và seams ở spec.md.

| Slice | Scenario | Red | Green |
| --- | --- | --- | --- |
| Backend list | BDD-EM-01/02/04/05 | HTTP và PostgreSQL test FAIL 404 vì endpoint chưa tồn tại | PASS; final G6 integration 5 tests |
| Backend detail/auth/validation | BDD-EM-03/06/08/09 | Detail FAIL 404; huge-page test FAIL (200 thay vì 400) | PASS; 17 HTTP tests và 5 G6 PostgreSQL tests |
| Frontend visibility | BDD-EM-07 | FAIL: 30 giây chỉ có 2 thay vì 4 requests; hidden mount phát 1 request thay vì 0 | PASS 2 tests: list/detail polling, rolling range, resume, cleanup |
| Frontend list/detail | BDD-EM-06/09/10 | FAIL: không có workflow/node data khi page còn rỗng | PASS 4 tests: owner UUID/filter/navigation, null/0ms/retry, read error/empty/404 |

Commands tại project tương ứng:

- Backend list/detail: `node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --runTestsByPath test/integration/admin/executions.integration-spec.ts`.
- Backend HTTP: `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath test/unit/admin/admin-executions.spec.ts`.
- Frontend visibility/UI: `node node_modules/vitest/vitest.mjs run --environment jsdom --maxWorkers=2 src/features/admin/hooks/useAdminExecutions.test.tsx src/features/admin/pages/ExecutionsPage.test.tsx`.
- Initial PostgreSQL run bị lỗi kết nối localhost:5433, không tính là Red. Sau khi khởi động Docker PostgreSQL của repo, test đã chạy và FAIL 404 đúng hành vi thiếu.
- Initial frontend import failure không tính là Red: đã thêm page/hook scaffold và xác nhận failures ở assertions về dữ liệu/polling trước khi implement.

## Final checks

| Check | Command / kết quả |
| --- | --- |
| Backend lint | `npm run lint:ci` — PASS; lỗi formatter và unsafe Jest matchers ở test mới đã được sửa |
| Backend type-check | `node node_modules/typescript/bin/tsc --noEmit` — PASS |
| Backend unit regression | `node node_modules/jest/bin/jest.js --runInBand --testPathPatterns 'test/unit/(admin\|execution\|auth)'` — 29 suites / 347 tests PASS; HTTP test sau chỉnh types: 17 PASS |
| Backend integration | `node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --testPathPatterns 'test/integration/admin/'` — 3 suites / 30 tests PASS, bao gồm 5 tests G6; database riêng được xóa sau suite |
| Backend build | `node node_modules/@nestjs/cli/bin/nest.js build` — webpack compiled successfully; dùng trực tiếp CLI sau lint:ci để tránh prebuild lint --fix |
| Frontend lint | `npm run lint` — PASS; lỗi Date.now trong render đã được sửa bằng lazy initial state |
| Frontend type-check | `node node_modules/typescript/bin/tsc -b` — PASS; 2 test files G6 cũng PASS với cấu hình tạm extends tsconfig.app.json, include 2 files và exclude [] |
| Frontend Admin tests | `node node_modules/vitest/vitest.mjs run --environment jsdom --maxWorkers=2 src/features/admin` — 10 files / 26 tests PASS |
| Frontend build | `node node_modules/vite/bin/vite.js build` sau tsc -b — PASS; Vite báo cảnh báo chunk > 500kB, không chặn build |
| Prisma | `prisma validate`, `prisma generate` — PASS; migration mới deploy thành công trên database test riêng |
| Local database | `prisma migrate status` xác nhận chỉ thiếu migration G6; `prisma migrate deploy` áp dụng thành công; status cuối: Database schema is up to date (flowpilot, localhost:5433) |

## Giới hạn và vận hành

- retryCount phản ánh giá trị đã lưu. G6 không bổ sung thống kê retry bên trong provider; runtime hiện có thể để giá trị này ở default 0.
- Polling không hủy một HTTP request đã bắt đầu trước khi tab hidden; không phát request polling mới khi hidden. Khi unmount, AbortSignal của Query được chuyển đến HTTP client.
- Pagination ổn định trong mỗi snapshot; các lượt chạy mới có thể làm thay đổi trang giữa hai lần refresh.
- Không đo benchmark/query plan trên dữ liệu production lớn. Hai index mới phục vụ global sort/status; workflow index hiện có được tái sử dụng.
