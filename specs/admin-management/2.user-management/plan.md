# Kế hoạch Triển khai: Quản lý Tài khoản (User Management)

Status: completed (PR #39)

## 1. Mục tiêu và Phạm vi
Giai đoạn này (G2) tập trung hoàn thành các chức năng quản lý tài khoản người dùng cho Admin, thiết lập cơ chế khóa tài khoản có ảnh hưởng runtime đến workflow và các transaction locks bảo vệ hệ thống.

## 2. Các Bước Triển khai Đã Hoàn thành

1. **Backend Application & Commands**:
   - Viết `ManageAccountCommand` và handler trong `libs/auth`.
   - Cài đặt advisory lock `7261101` và kiểm tra logic invariant (tự khóa, last Admin, target inactive).
   - Tích hợp ghi nhận sự kiện `USER_SUSPENDED`, `USER_REACTIVATED`, `USER_ROLE_CHANGED` vào `admin_audit_events`.
   - Kết nối ghi outbox `session_revocations` để vô hiệu hóa token người dùng.
2. **Backend Query Projections**:
   - Triển khai `AdminReadPort.users()`, `.user(id)`, `.workflows(id)` trong `PrismaAdminRead`.
   - Đảm bảo projection an toàn chỉ chứa các trường whitelist, đếm chính xác execution của workflow thuộc owner.
3. **Runtime Execution & Trigger Gates**:
   - Thêm kiểm tra owner active tại `ExecutionProcessor` khi worker claim job.
   - Chuyển trạng thái `CANCELLED` với `cancellationReason = 'OWNER_SUSPENDED'` khi owner bị khóa.
   - Thêm gate loại bỏ webhook payload tại gateway khi workflow thuộc owner bị khóa (vẫn trả HTTP ACK).
4. **Frontend UI Components**:
   - Xây dựng `UsersPage.tsx` có bộ lọc, tìm kiếm và phân trang.
   - Xây dựng `UserDetailPage.tsx` hiển thị hồ sơ, counts và bảng workflow.
   - Xây dựng `AccountChangeDialog.tsx` yêu cầu nhập reason và xử lý xung đột `409`.
5. **Kiểm thử Thực tế**:
   - Kiểm thử unit test cho `ManageAccountCommand` (xử lý no-op, stale revision, last active admin).
   - Kiểm thử integration test với PostgreSQL thật mô phỏng 2 Admin cùng lúc hạ quyền nhau.
   - Kiểm thử runtime: Khóa tài khoản -> Trigger webhook và claim execution -> Xác nhận execution bị hủy đúng chuẩn.
