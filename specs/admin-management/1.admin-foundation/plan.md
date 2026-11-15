# Kế hoạch Triển khai: Nền tảng Quản trị, Phân quyền và Quản lý Phiên (Admin Foundation)

Status: completed (PR #39)

## 1. Mục tiêu và Phạm vi
Giai đoạn này (G1) tập trung xây dựng nền móng phân quyền, thu hồi token, bảo vệ cổng vào khu vực Admin, và chuyển đổi mô hình dữ liệu cũ sang 2 role mới.

## 2. Các Bước Triển khai Đã Hoàn thành

1. **Migration Cơ sở dữ liệu**:
   - Viết migration `20261114000000_admin_p0`: Chuyển đổi enum `UserRole` cũ sang `CLIENT`, `ADMIN`.
   - Bổ sung `revision`, `session_version` vào bảng `users`.
   - Tạo bảng `admin_audit_events` và `session_revocations`.
2. **Backend Authentication & Authorization**:
   - Cập nhật Prisma mapper, entity `User`, và auth commands.
   - Bổ sung claim `sessionVersion` vào access token và refresh token.
   - Cập nhật `JwtStrategy` kiểm tra `sessionVersion` khớp với database.
   - Xây dựng transaction outbox worker dọn dẹp Redis session khi có yêu cầu thu hồi.
   - Viết script CLI `admin:bootstrap` để cấp quyền Admin đầu tiên có kiểm toán.
3. **Admin Module Scaffolding**:
   - Khởi tạo `monolith-backend/libs/admin`.
   - Tạo `AdminController`, gắn `JwtAuthGuard`, `RolesGuard(ADMIN)`, và `AdminMutationFieldsGuard`.
4. **Frontend Admin Shell**:
   - Tạo layout `AdminLayout.tsx` với header, navigation bar, footer.
   - Tạo `AdminGuard.tsx` để bảo vệ client-side routing.
   - Thêm nút Quản trị trên Navbar workspace và menu tài khoản.
   - Loại bỏ lựa chọn role khỏi form đăng ký.
5. **Kiểm thử**:
   - Viết unit tests cho guards, token revocation logic, và CLI bootstrap.
   - Viết integration tests xác nhận phân quyền HTTP `401`, `403` và luồng migration dữ liệu cũ.
