# Spec: Nền tảng Quản trị, Phân quyền và Quản lý Phiên (Admin Foundation)

Status: completed (PR #39)

## 1. Mục tiêu và Bối cảnh
Thiết lập nền tảng truy cập khu vực Quản trị (Admin) của FlowPilot với mô hình phân quyền tối giản và an toàn gồm 2 role: `CLIENT` và `ADMIN`. Đảm bảo thu hồi phiên tức thì khi có thay đổi quyền hạn hoặc trạng thái tài khoản.

Nguồn yêu cầu: [SRS](../../../docs/srs.md) (FR-AU-01, FR-AU-07, FR-AU-09), [PRD](../../../docs/prd.md).

## 2. Yêu cầu Chức năng (Functional Requirements)

### FR-AF-01: Mô hình Hai Role và Ranh giới Phân quyền
- Hệ thống chỉ hỗ trợ 2 vai trò:
  - `CLIENT`: Người dùng thông thường, tự tạo, sở hữu và vận hành workflow, credential của mình.
  - `ADMIN`: Quản trị viên nền tảng, có quyền truy cập khu vực `/admin/*` và các API `/api/admin/*`.
- Các role cũ `DEVELOPER` và `BUSINESS_USER` đã được chuyển đổi thành `CLIENT` trong cơ sở dữ liệu.
- Đăng ký công khai (`/api/auth/register`) luôn tạo tài khoản mang role `CLIENT`. Nếu client cố tình gửi field `role` trong payload đăng ký, hệ thống từ chối với HTTP `400 Bad Request`.

### FR-AF-02: Bảo vệ Cổng Truy cập Admin
- Toàn bộ route `/admin/*` và API `/api/admin/*` bắt buộc phải qua `JwtAuthGuard` và `RolesGuard(ADMIN)`.
- Request chưa xác thực trả về `401 Unauthorized`.
- Client có phiên đăng nhập hợp lệ nhưng không phải Admin gọi API Admin bị từ chối với `403 Forbidden`.
- Backend kiểm tra role và trạng thái `isActive` trực tiếp từ database khi xử lý request, không tin cậy claim tĩnh trong token cũ.

### FR-AF-03: Cấp quyền Admin Đầu tiên (Initial Bootstrap)
- Production tuyệt đối không mở public API để tự cấp quyền Admin và không dùng mật khẩu mặc định hardcoded.
- Admin đầu tiên được cấp phát thông qua công cụ CLI nội bộ:
  `npm run admin:bootstrap -- 'email@example.com' 'Ly do cap quyen'`
- Lệnh bootstrap chỉ hoạt động khi tài khoản đã tồn tại, đang active và hệ thống chưa có Admin active nào.
- Ghi nhận sự kiện kiểm toán `ADMIN_BOOTSTRAPPED` với `actorType = SYSTEM` vào `admin_audit_events`.
- Môi trường local development hỗ trợ seed sẵn tài khoản `admin@flowpilot.local` / `Admin123!`.

### FR-AF-04: Quản lý Phiên và Thu hồi Quyền Tức thì (Token Revocation)
- `User` có trường `session_version` (integer, mặc định 0).
- Cả Access Token và Refresh Token đều mang payload `sessionVersion`.
- Khi tài khoản bị khóa hoặc thay đổi role, `session_version` được tăng lên 1 đơn vị trong cùng transaction database:
  - Mọi JWT cũ mang version cũ lập tức bị JWT strategy từ chối `401 Unauthorized`.
  - Một bản ghi thu hồi được ghi vào bảng outbox `session_revocations` để worker dọn dẹp refresh token trong Redis.
  - Nếu Redis tạm thời mất kết nối, cơ chế so khớp `session_version` trên PostgreSQL vẫn bảo đảm chặn 100% token cũ.
- Khi mở khóa tài khoản, `session_version` tiếp tục tăng lên, bảo đảm token trước khi khóa không thể tái sử dụng; người dùng bắt buộc phải đăng nhập lại.

### FR-AF-05: Giao diện và Điều hướng Admin (Admin Layout)
- Bổ sung `AdminLayout.tsx` với thanh điều hướng Header mang nhãn hiệu FlowPilot Admin.
- Nút **Quản trị** trên Navbar workspace chỉ hiển thị khi tài khoản có role `ADMIN`.
- Trong khu vực Admin có nút **Về workspace** (Back to workspace) để chuyển nhanh về `/workflows`.
- `AdminGuard.tsx` bảo vệ route frontend: chuyển hướng về login nếu chưa đăng nhập, hiển thị thông báo không có quyền nếu là Client.

## 3. Tiêu chí Nghiệm thu (Acceptance Criteria)
- **AC-AF-01**: Client gọi API `/api/admin/*` nhận HTTP `403`, không lộ dữ liệu.
- **AC-AF-02**: Đăng ký truyền `role: ADMIN` bị từ chối HTTP `400`.
- **AC-AF-03**: Dữ liệu role cũ được chuyển đổi sạch sẽ thành `CLIENT`, không mất mát quan hệ.
- **AC-AF-04**: Đổi role hoặc khóa tài khoản làm access/refresh token cũ hết hiệu lực ngay lập tức.
- **AC-AF-05**: Lệnh bootstrap CLI tạo Admin đầu tiên thành công và ghi SYSTEM audit; gọi lần 2 bị chặn.
