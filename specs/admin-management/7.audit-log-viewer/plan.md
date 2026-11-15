# Kế hoạch Triển khai: Trình tra cứu Nhật ký Quản trị (Audit Log Viewer)

Status: ready-for-agent (P1)

## 1. Mục tiêu và Phạm vi
Giai đoạn G7 triển khai API tra cứu và màn hình giao diện hiển thị lịch sử kiểm toán toàn diện cho Quản trị viên, phục vụ giải trình và giám sát thay đổi hệ thống.

## 2. Kế hoạch Triển khai Chi tiết

### Bước 1: Chuẩn hóa Ghi nhận Audit ở các Domain
- Kiểm tra các command handler ở G1 (Bootstrap), G2 (User active & role), G4 (Connector policy), G5 (Node type status).
- Đảm bảo tất cả đều ghi vào `admin_audit_events` cùng transaction, kèm lý do và before/after theo đúng whitelist.

### Bước 2: Backend Query Projection
- Mở rộng `AdminReadPort` với `.auditEvents(filter)` và `.auditEvent(id)`.
- Triển khai trong `PrismaAdminRead`:
  - Truy vấn bảng `admin_audit_events` kết hợp join `users` để lấy tên/email của actor.
  - Phân trang server-side, sắp xếp `createdAt desc`, `id desc`.

### Bước 3: Presentation Endpoints
- Viết `AdminAuditFilterDto`.
- Thêm `GET /api/admin/audit-events` và `GET /api/admin/audit-events/:id` trong `AdminController`.

### Bước 4: Frontend Development
- Cập nhật `admin.types.ts` và `admin.service.ts`.
- Xây dựng hook `useAdminAudit.ts`.
- Xây dựng các components: `AuditEventFilterBar.tsx`, `AuditEventTable.tsx`, `AuditDiffDialog.tsx`.
- Xây dựng trang `AuditEventsPage.tsx`.

### Bước 5: Kiểm thử Tự động
- Viết unit test cho DTO validation và query filter.
- Viết integration test xác nhận join actor thông tin và tính bất biến (không có mutation/delete endpoints).
- Viết frontend test kiểm tra render diff Before vs After và xử lý phân trang.
