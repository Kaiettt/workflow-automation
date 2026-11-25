# Kế hoạch Triển khai: Giám sát Execution Toàn Nền Tảng (Execution Monitoring)

Status: implemented (P1, 2026-11-24)

## 1. Mục tiêu và Phạm vi
Giai đoạn G6 xây dựng tính năng theo dõi và tra cứu execution toàn hệ thống cho Quản trị viên, hỗ trợ vận hành mà không xâm phạm quyền riêng tư của Client.

## 2. Kế hoạch Triển khai Chi tiết

### Bước 1: Database Indexing
- Reuse workflow/queuedAt/id index; thêm global queuedAt/id và status/queuedAt/id theo design.
- Tạo migration reviewable, generate Prisma và kiểm tra migrate deploy trên database test riêng.

### Bước 2: Backend Query Projection (Safe Whitelist)
- Mở rộng `AdminReadPort` với `.executions(filter)` và `.execution(id)`.
- Triển khai trong `PrismaAdminRead`:
  - Lập trình câu lệnh `SELECT` tĩnh với whitelist an toàn.
  - Tuyệt đối không chọn các cột `input`, `output`, `context`, `errorMessage`, `errorStack`.
  - Áp dụng `safeExecutionErrorCode()` để chuẩn hóa mã lỗi fallback.

### Bước 3: Presentation Endpoints
- Viết `AdminExecutionFilterDto`.
- Thêm `GET /api/admin/executions` và `GET /api/admin/executions/:id` trong `AdminController`.

### Bước 4: Frontend Development
- Cập nhật `admin.types.ts` và `admin.service.ts`.
- Xây dựng hook `useAdminExecutions.ts` có visible-only polling 30 giây.
- Xây dựng các components: `ExecutionFilterBar.tsx`, `ExecutionTable.tsx`, `NodeLogsTimeline.tsx`.
- Xây dựng các trang: `ExecutionsPage.tsx` và `ExecutionDetailPage.tsx`.
- Đảm bảo giao diện 100% read-only.

### Bước 5: Kiểm thử Tự động
- Viết unit test cho DTO validation và query filter.
- Viết integration test asserting rò rỉ dữ liệu nhạy cảm (secrets, prompt, payload, stack trace).
- Viết frontend test kiểm tra render an toàn, trạng thái null timing và polling dừng khi ẩn tab.

## 3. BDD/TDD theo lát cắt

1. List: filters/range/sort/pagination/ownership/privacy qua PostgreSQL/HTTP.
2. Detail: whitelist/null/error/retry/status; validation/auth/404 qua HTTP.
3. Hook visibility và UI list/detail tại HTTP/browser boundary.
4. Ghi Red/Green/checks trong task.md. Kiểm tra migration trên database test riêng, sau đó áp dụng migration index G6 duy nhất còn thiếu trên database local flowpilot (localhost:5433).
