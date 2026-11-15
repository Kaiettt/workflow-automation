# Checklist: Quản lý Tài khoản (User Management)

Status: completed (PR #39)

- [x] G2.1 Triển khai `AdminReadPort.users()` với tìm kiếm `q`, lọc `role`, `isActive`, phân trang và sắp xếp giảm dần `createdAt`.
- [x] G2.2 Triển khai `AdminReadPort.user(id)` trả về metadata và tổng hợp `counts.workflows`, `counts.credentials`, `counts.executions` (tính cả lượt chạy tự động).
- [x] G2.3 Triển khai `AdminReadPort.workflows(id)` trả về danh sách workflow tóm tắt của tài khoản có phân trang.
- [x] G2.4 Xây dựng `ManageAccountCommand` trong `libs/auth`, thiết lập transaction advisory lock `7261101` và pessimistic row lock `FOR UPDATE`.
- [x] G2.5 Cài đặt kiểm tra bất biến: Chặn Admin tự sửa chính mình, chặn hạ quyền Admin active cuối cùng, chặn cấp Admin cho user inactive, kiểm tra `expectedRevision`.
- [x] G2.6 Gắn xử lý no-op khi request gửi trùng giá trị hiện tại (không tăng revision, không ghi audit giả).
- [x] G2.7 Kết nối ghi `admin_audit_events` và `session_revocations` cùng transaction với cập nhật user.
- [x] G2.8 Cập nhật `ExecutionProcessor`: Kiểm tra trạng thái owner khi claim job queued; nếu inactive, chuyển `CANCELLED`/`OWNER_SUSPENDED` và không gọi executor.
- [x] G2.9 Cập nhật webhook gateway: Acknowledge provider nhưng loại bỏ sự kiện khi owner workflow bị khóa.
- [x] G2.10 Xây dựng `UsersPage.tsx` có bộ lọc, tìm kiếm, phân trang và badge trạng thái.
- [x] G2.11 Xây dựng `UserDetailPage.tsx` và `AccountChangeDialog.tsx` có form lý do (5–500 ký tự), xác nhận và xử lý xung đột `409`.
- [x] G2.12 Viết unit và integration tests kiểm chứng AC-UM-01 đến AC-UM-07 (tra cứu, counts, concurrency, cancellation gate, audit atomic).
