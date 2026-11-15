# Kế hoạch Triển khai: Giám sát Execution Toàn Nền Tảng (Execution Monitoring)

Status: ready-for-agent (P1)

## 1. Mục tiêu và Phạm vi
Giai đoạn G6 xây dựng tính năng theo dõi và tra cứu execution toàn hệ thống cho Quản trị viên, hỗ trợ vận hành mà không xâm phạm quyền riêng tư của Client.

## 2. Kế hoạch Triển khai Chi tiết

### Bước 1: Database Indexing
- Bổ sung composite index trên model `Execution`: `[queuedAt, status]` và `[workflowId, queuedAt]`.
- Chạy `prisma migrate dev` và `prisma generate`.

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
