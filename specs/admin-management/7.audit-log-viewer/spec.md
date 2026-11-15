# Spec: Trình tra cứu Nhật ký Quản trị (Audit Log Viewer)

Status: ready-for-agent (P1)

## 1. Mục tiêu và Bối cảnh
Cung cấp màn hình tra cứu lịch sử kiểm toán toàn diện và minh bạch cho Quản trị viên, theo dõi toàn bộ các tác động quản trị trên hệ thống, xem đối chiếu chi tiết thay đổi (Diff Before vs After) trên các trường dữ liệu an toàn.

Nguồn yêu cầu: [SRS](../../../docs/srs.md) (FR-AD-05, FR-AU-09), [PRD](../../../docs/prd.md).

## 2. Yêu cầu Chức năng (Functional Requirements)

### FR-AL-01: Phạm vi Ghi nhận Kiểm toán (Audit Logging Scope)
Mọi thao tác quản trị có hiệu lực làm thay đổi dữ liệu phải được ghi nhận vào `admin_audit_events` cùng database transaction với mutation nghiệp vụ:
1. `USER_SUSPENDED`: Khóa tài khoản người dùng (G2 - Đã có).
2. `USER_REACTIVATED`: Mở khóa tài khoản người dùng (G2 - Đã có).
3. `USER_ROLE_CHANGED`: Đổi vai trò Client ↔ Admin (G2 - Đã có).
4. `ADMIN_BOOTSTRAPPED`: Khởi tạo Admin đầu tiên qua lệnh CLI nội bộ (G1 - Đã có).
5. `CONNECTOR_POLICY_CHANGED`: Thay đổi chính sách `allowNewCredentials` của connector (G4 - Mới).
6. `NODE_TYPE_STATUS_CHANGED`: Thay đổi trạng thái `isCatalogVisible` hoặc `isExecutionAllowed` của node type (G5 - Mới).

### FR-AL-02: Cấu trúc Bản ghi và Whitelist Trước/Sau (Before/After)
- Bản ghi audit gồm: `id` (UUID), `actorType` (`ADMIN`, `SYSTEM`), `actorId` (UUID hoặc null), `action` (tên hành động), `targetType` (`USER`, `CONNECTOR`, `NODE_TYPE`), `targetId` (UUID hoặc key), `reason` (chuỗi lý do bắt buộc từ 5 đến 500 ký tự), `before` (JSON), `after` (JSON), `createdAt` (UTC timestamp).
- **Nguyên tắc Whitelist Before/After**:
  - Tuyệt đối không chụp toàn bộ object (snapshot dump).
  - Chỉ lưu các trường trạng thái liên quan:
    - User mutations: `{ isActive, role, revision }`.
    - Connector policy mutations: `{ allowNewCredentials, revision }`.
    - Node type status mutations: `{ isCatalogVisible, isExecutionAllowed, revision }`.
    - Bootstrap: `{ role: 'ADMIN', isActive: true }`.

### FR-AL-03: Danh sách và Bộ lọc Nhật ký Quản trị
- API `GET /api/admin/audit-events`:
  - **Bộ lọc**:
    - `actorId`: Lọc theo ID quản trị viên thực hiện.
    - `actorType`: Lọc theo `ADMIN` hoặc `SYSTEM`.
    - `action`: Lọc theo tên hành động cụ thể.
    - `targetType`: Lọc theo loại tài nguyên (`USER`, `CONNECTOR`, `NODE_TYPE`).
    - `targetId`: Lọc theo ID tài nguyên mục tiêu.
    - `from` và `to`: Khoảng thời gian nửa mở `[from, to)` (tối đa 90 ngày).
  - Phân trang server-side (`page`, `pageSize`, mặc định 20, tối đa 100), sắp xếp giảm dần theo thời gian tạo (`createdAt desc`, `id desc`).
  - Response danh sách bao gồm thông tin tóm tắt kèm tên/email của actor (nếu có).

### FR-AL-04: Chi tiết Sự kiện và Đối chiếu Thay đổi (Diff Viewer)
- API `GET /api/admin/audit-events/:id`:
  - Trả về thông tin chi tiết sự kiện kiểm toán: Mã sự kiện, người thực hiện (tên, email), hành động, tài nguyên mục tiêu (loại, ID, tên nếu join được), thời điểm chính xác (UTC và local), lý do Admin đã nhập.
  - Khối dữ liệu Before và After được hiển thị đối chiếu trực quan (Diff Viewer): Nổi bật các trường bị thay đổi (ví dụ: `isActive: true` -> `isActive: false`).

### FR-AL-05: Tính Bất biến và Toàn vẹn (Immutability & Atomic Writes)
- Bảng `admin_audit_events` hoàn toàn chỉ đọc: Backend tuyệt đối không cung cấp bất kỳ API nào để cập nhật (`PUT`/`PATCH`) hay xóa (`DELETE`) bản ghi audit.
- Ghi nhận atomic: Nếu việc ghi bản ghi audit vào cơ sở dữ liệu gặp lỗi, toàn bộ transaction của mutation đó bắt buộc phải bị rollback; hệ thống không bao giờ ghi nhận thay đổi thành công mà thiếu bản ghi audit tương ứng.
- Các thao tác no-op hoặc request bị từ chối do phân quyền / sai revision không được phát sinh bản ghi audit.

## 3. Tiêu chí Nghiệm thu (Acceptance Criteria)
- **AC-AL-01**: Admin tra cứu danh sách audit events lọc theo actor, action, target và thời gian chính xác; phân trang đúng.
- **AC-AL-02**: Xem chi tiết audit event hiển thị đầy đủ thông tin actor, target, lý do và diff Before/After theo đúng whitelist.
- **AC-AL-03**: Bảng audit events bất biến 100%; không có bất kỳ endpoint chỉnh sửa hoặc xóa nào.
- **AC-AL-04**: Ghi audit thất bại làm rollback toàn bộ transaction mutation tương ứng.
- **AC-AL-05**: Toàn bộ các thao tác thay đổi ở G1, G2, G4, G5 đều phát sinh bản ghi audit tương ứng với action chuẩn hóa.
