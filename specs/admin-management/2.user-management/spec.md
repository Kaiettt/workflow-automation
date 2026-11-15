# Spec: Quản lý Tài khoản (User Management)

Status: completed (PR #39)

## 1. Mục tiêu và Bối cảnh
Cung cấp khả năng tra cứu, tìm kiếm, xem chi tiết, khóa/mở khóa tài khoản và thay đổi vai trò (Client ↔ Admin) cho Quản trị viên, đi kèm các biện pháp bảo vệ tính toàn vẹn (bảo vệ Admin cuối cùng) và tác động runtime (chặn webhook, hủy job queued của tài khoản bị khóa).

Nguồn yêu cầu: [SRS](../../../docs/srs.md) (FR-AD-01, FR-AD-02, FR-AD-03, FR-CF-07), [PRD](../../../docs/prd.md).

## 2. Yêu cầu Chức năng (Functional Requirements)

### FR-UM-01: Danh sách và Tìm kiếm Tài khoản
- API `GET /api/admin/users`:
  - Tìm kiếm theo `q` (tên hoặc email, không phân biệt hoa thường).
  - Lọc theo `role` (`CLIENT`, `ADMIN`), lọc theo `isActive` (`true`, `false`).
  - Phân trang server-side (`page`, `pageSize`, mặc định 20, tối đa 100).
  - Sắp xếp giảm dần theo thời điểm tạo (`createdAt desc`, `id desc`).
  - Projection an toàn: Chỉ trả về `id`, `name`, `email`, `role`, `isActive`, `revision`, `createdAt`, `updatedAt`. Tuyệt đối không trả password hash, session token, refresh token hay OTP.

### FR-UM-02: Chi tiết Tài khoản và Thống kê Tài nguyên
- API `GET /api/admin/users/:id`:
  - Trả về thông tin tài khoản và tổng số tài nguyên liên quan: `counts.workflows` (số workflow sở hữu), `counts.credentials` (số credential kết nối), `counts.executions` (tổng số lần chạy workflow thuộc quyền sở hữu, tính cả lần chạy tự động không có `triggeredById`).
- API `GET /api/admin/users/:id/workflows`:
  - Danh sách workflow tóm tắt có phân trang: `id`, `name`, `status` (`DRAFT`, `PUBLISHED`, `ARCHIVED`), `active`, `updatedAt`. Không trả về canvas definition, config, hay snapshot version.

### FR-UM-03: Khóa và Mở khóa Tài khoản (Suspend / Reactivate)
- API `PATCH /api/admin/users/:id/active`:
  - Request body: `{ isActive: boolean, reason: string, expectedRevision: number }`.
  - Lý do (`reason`) bắt buộc từ 5 đến 500 ký tự.
  - Quy tắc bất biến:
    - Admin không thể tự khóa tài khoản của chính mình.
    - Không thể khóa tài khoản Admin active cuối cùng trong hệ thống.
  - Kiểm tra `expectedRevision`: Nếu bản ghi đã bị thay đổi trước đó, trả về HTTP `409 Conflict` (`STALE_REVISION`).
  - Xử lý No-op: Nếu request gửi cùng giá trị `isActive` hiện tại, xử lý thành công nhưng không tăng revision, không ghi audit giả và không thu hồi phiên.
  - Tác động tức thì: Khóa làm tăng `session_version`, thu hồi toàn bộ access/refresh token cũ.

### FR-UM-04: Tác động Runtime khi Khóa Tài khoản
- **Ngăn chặn kích hoạt mới**: Chặn manual run, schedule trigger, và webhook trigger của các workflow thuộc tài khoản bị khóa.
- **Webhook Gateway Handshake**: Webhook gửi đến vẫn được trả HTTP ACK (200/202) theo contract của nhà cung cấp bên ngoài nhưng payload bị loại bỏ ngay lập tức, không đưa vào hàng đợi `QUEUED` và không lưu vào test-event store.
- **Worker Execution Gate**: Khi worker claim một execution đang ở trạng thái `QUEUED`: kiểm tra trạng thái owner row trong cùng transaction; nếu owner đã bị khóa (`isActive = false`), execution lập tức chuyển trạng thái thành `CANCELLED` với lý do `OWNER_SUSPENDED`, không gọi executor hay gọi dịch vụ ngoài.
- **Bảo toàn Execution đang chạy**: Các execution đã chuyển sang `RUNNING` trước thời điểm khóa được phép chạy đến khi hoàn tất bình thường.
- **Không Replay khi Mở khóa**: Mở khóa tài khoản cho phép nhận sự kiện mới theo cấu hình active hiện có của workflow; không tự động chạy lại các sự kiện đã bị bỏ qua hoặc các lượt đã bị hủy.

### FR-UM-05: Chuyển đổi Vai trò Tài khoản (Role Change)
- API `PATCH /api/admin/users/:id/role`:
  - Request body: `{ role: 'CLIENT' | 'ADMIN', reason: string, expectedRevision: number }`.
  - Quy tắc bất biến:
    - Admin không thể tự thay đổi role của chính mình.
    - Không thể hạ quyền tài khoản Admin active cuối cùng trong hệ thống.
    - Không thể nâng quyền Admin cho tài khoản đang bị khóa (`isActive = false`).
  - Kiểm tra advisory lock trong database transaction để đảm bảo khi 2 Admin cùng lúc hạ quyền nhau thì luôn còn lại ít nhất 1 Admin active.
  - Tác động tức thì: Tăng `session_version`, thu hồi toàn bộ token cũ. Admin bị hạ quyền xuống Client sẽ không thể dùng token cũ để gọi API Admin.

## 3. Tiêu chí Nghiệm thu (Acceptance Criteria)
- **AC-UM-01**: Admin tra cứu và lọc danh sách tài khoản chính xác; response không chứa dữ liệu nhạy cảm.
- **AC-UM-02**: Xem chi tiết tài khoản hiển thị đầy đủ số workflow, credential và tổng execution của owner.
- **AC-UM-03**: Khóa tài khoản thành công vô hiệu hóa token cũ; mở khóa cho phép đăng nhập lại nhưng không khôi phục token cũ.
- **AC-UM-04**: Workflow của tài khoản bị khóa bị chặn webhook và job queued bị hủy `OWNER_SUSPENDED`.
- **AC-UM-05**: Admin tự khóa/đổi role hoặc 2 Admin cùng hạ quyền nhau bị chặn; luôn còn ít nhất 1 Admin active.
- **AC-UM-06**: Request mang `expectedRevision` cũ nhận HTTP `409 Conflict`.
- **AC-UM-07**: Mọi thao tác thay đổi active hoặc role đều ghi nhận sự kiện `USER_*` vào `admin_audit_events` cùng transaction.
