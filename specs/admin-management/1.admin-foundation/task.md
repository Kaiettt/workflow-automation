# Checklist: Nền tảng Quản trị, Phân quyền và Quản lý Phiên (Admin Foundation)

Status: completed (PR #39)

- [x] G1.1 Viết migration `20261114000000_admin_p0`: Chuyển đổi enum `UserRole` cũ (`DEVELOPER`, `BUSINESS_USER`) sang `CLIENT`, giữ `ADMIN`, bổ sung `revision`, `session_version`, tạo bảng `admin_audit_events` và `session_revocations`.
- [x] G1.2 Đồng bộ hóa enum `UserRole` trên toàn bộ tầng auth backend, frontend auth store, database seed và test fixtures.
- [x] G1.3 Cập nhật Register DTO và command để public registration từ chối field `role` và luôn tạo tài khoản role `CLIENT`.
- [x] G1.4 Bổ sung claim `sessionVersion` vào access/refresh token; cập nhật `JwtStrategy` kiểm tra `sessionVersion` với database.
- [x] G1.5 Triển khai outbox pattern dọn dẹp Redis session khi có bản ghi trong `session_revocations`.
- [x] G1.6 Tạo lệnh CLI nội bộ `npm run admin:bootstrap` cho phép cấp quyền Admin đầu tiên với kiểm toán `ADMIN_BOOTSTRAPPED`.
- [x] G1.7 Khởi tạo module `libs/admin`, tạo `AdminController` và thiết lập các guards: `JwtAuthGuard`, `RolesGuard(ADMIN)`, `AdminMutationFieldsGuard`.
- [x] G1.8 Xây dựng `AdminLayout.tsx`, `AdminGuard.tsx`, bổ sung nút "Quản trị" trên Navbar và "Về workspace" trong khu vực Admin.
- [x] G1.9 Viết unit và integration tests kiểm chứng AC-AF-01 đến AC-AF-05 (bảo vệ endpoint, từ chối role khi đăng ký, vô hiệu hóa token cũ, bootstrap an toàn).
