# Sổ tay Vận hành Khu vực Admin (Operations Guide)

Status: ready-for-agent

Tài liệu này hướng dẫn chi tiết quy trình triển khai, cấu hình, vận hành và xử lý sự cố cho toàn bộ tính năng Quản trị (Admin) của nền tảng FlowPilot.

Lưu ý quan trọng: Các lệnh database và backend phải chạy trong thư mục `monolith-backend` (nơi có Prisma CLI và cấu hình dự án được thiết lập chuẩn).

---

## 1. Hướng dẫn Triển khai và Migration Cơ sở Dữ liệu

### 1.1. Lịch sử Migration và Trạng thái
- **Migration P0 (`20261114000000_admin_p0`)**: Đã áp dụng. Chuyển đổi 2 role cũ `DEVELOPER`/`BUSINESS_USER` sang `CLIENT`, bổ sung `revision`, `session_version`, `admin_audit_events`, `session_revocations`, và các cột `error_code`, `cancellation_reason`.
- **Migration P1 (`20261116000000_admin_p1`)**: Sắp triển khai. Bổ sung 2 bảng chính sách độc lập:
  - `connector_policies`: Quản lý cờ `allow_new_credentials` và `revision`.
  - `node_type_policies`: Quản lý cờ `is_catalog_visible`, `is_execution_allowed` và `revision`.

### 1.2. Trình tự Triển khai Không Gián đoạn (Zero-Downtime Rollout)
Chạy các lệnh sau trong `monolith-backend`:

```powershell
cd 'monolith-backend'

# 1. Áp dụng migration cơ sở dữ liệu
npx --no-install prisma migrate deploy

# 2. Sinh lại Prisma Client
npx --no-install prisma generate

# 3. Build mã nguồn backend production
npm run build
```

*Tính tương thích ngược*: Các bảng `connector_policies` và `node_type_policies` hoạt động theo cơ chế fallback: Nếu một connector hoặc node type chưa có bản ghi trong bảng policy, ứng dụng tự động coi giá trị là `true`. Do đó, việc chạy migration trước khi khởi động phiên bản backend/worker mới là an toàn 100%.

Trong thư mục `frontend`:
```powershell
cd 'frontend'

# Build frontend production
npm run build
```

---

## 2. Quản lý Tài khoản và Cấp quyền Admin

### 2.1. Đăng nhập Admin Môi trường Local Development
Seed hệ thống tự động khởi tạo tài khoản quản trị mẫu:
- **Email**: `admin@flowpilot.local`
- **Mật khẩu**: `Admin123!`
- **Truy cập**: Đăng nhập qua form Sign In thông thường. Sau khi đăng nhập, hệ thống tự động chuyển hướng đến `/admin`.
- Trên thanh điều hướng Header:
  - Tại workspace: Có nút **Quản trị (Admin)** và mục **Quản trị nền tảng** trong menu tài khoản.
  - Tại Admin: Có nút **Về workspace (Back to workspace)** để quay lại màn hình thiết kế.

*Quy tắc Seed*: Seed chỉ chạy trên localhost khi `NODE_ENV` ở chế độ development. Seed không bao giờ ghi đè mật khẩu, role, trạng thái khóa, hay session version của tài khoản đã tồn tại.

### 2.2. Cấp quyền Admin Đầu tiên trên Production
Trên môi trường Production, public API tuyệt đối không có lựa chọn cấp quyền Admin. Việc cấp Admin đầu tiên được thực hiện thông qua CLI nội bộ có ghi nhận kiểm toán:

```powershell
# Bước 1: Người dùng đăng ký tài khoản qua web và xác minh email bằng OTP
# Bước 2: Chạy lệnh bootstrap nội bộ trên máy chủ:
npm run admin:bootstrap -- 'nguoi-dung@cong-ty.com' 'Cấp quyền Admin đầu tiên cho hệ thống'
```

*Cơ chế an toàn*:
- Lệnh chỉ hoạt động khi tài khoản mục tiêu đã tồn tại, đang active, và hệ thống **chưa có bất kỳ Admin active nào**.
- Lệnh ghi nhận sự kiện kiểm toán với `actorType = SYSTEM` vào `admin_audit_events`.
- Sau khi đã có ít nhất một Admin, mọi thao tác phân quyền tiếp theo phải được thực hiện thông qua giao diện Web Quản trị (`/admin/users/:id`).

---

## 3. Quy trình Vận hành Tính năng P1 Mới

### 3.1. Quản lý Connector: Bảo trì Dịch vụ Bên Thứ Ba
Khi một dịch vụ bên ngoài (ví dụ Google Sheets, Slack) thay đổi chính sách OAuth hoặc đang bảo trì:

1. **Tạm ngừng cấp kết nối mới**:
   - Truy cập `/admin/connectors`.
   - Tìm connector cần bảo trì -> Bấm nút **Chính sách kết nối (Credential Policy)**.
   - Chuyển `Cho phép tạo kết nối mới` thành `Tắt (Disabled)`.
   - Nhập lý do bắt buộc (ví dụ: *"Google Sheets API đang bảo trì OAuth v2 đến 18:00"*).
   - Xác nhận thay đổi.
2. **Ảnh hưởng thực tế**:
   - Người dùng mới hoặc người dùng cũ khi bấm tạo kết nối Google Sheets sẽ nhận được thông báo từ chối `CONNECTOR_NEW_CREDENTIALS_DISABLED`.
   - **Tất cả các workflow và credential Google Sheets đã có từ trước vẫn chạy bình thường 100%**. Token tiếp tục được refresh tự động; workflow không bị gián đoạn.
3. **Mở lại kết nối**:
   - Sau khi bảo trì hoàn tất, Admin vào lại `/admin/connectors`, bật lại `Cho phép tạo kết nối mới` kèm lý do.

### 3.2. Quản lý Node Type: Ẩn Node vs Chặn Thực thi
Khi cần can thiệp một khối chức năng:

- **Trường hợp 1: Node lỗi thời hoặc đang nâng cấp phiên bản mới**:
  - Truy cập `/admin/node-types` -> Chọn node -> Bấm **Điều chỉnh trạng thái**.
  - Tắt **Hiển thị trên Palette (`isCatalogVisible = false`)**, giữ nguyên **Cho phép thực thi (`isExecutionAllowed = true`)**.
  - *Kết quả*: Node biến mất khỏi bảng chọn khối của Designer, ngăn người dùng tạo mới node lỗi thời. Các workflow cũ đã phát hành vẫn tiếp tục chạy thành công.
- **Trường hợp 2: Khẩn cấp - Phát hiện lỗ hổng bảo mật nghiêm trọng ở một Node**:
  - Tắt cả **Hiển thị trên Palette** và **Cho phép thực thi (`isExecutionAllowed = false`)**.
  - *Kết quả*: Mọi workflow đang chạy gặp node này sẽ bị dừng node an toàn với mã lỗi `NODE_TYPE_DISABLED`, không gây crash hệ thống worker.

### 3.3. Giám sát Execution và Xử lý Sự cố An Toàn
Khi người dùng báo cáo workflow bị lỗi:
1. Admin truy cập `/admin/executions`.
2. Sử dụng bộ lọc: Nhập email người dùng vào ô `Owner`, chọn `Status = FAILED`, chọn khoảng thời gian xảy ra sự cố.
3. Bấm vào chi tiết execution để xem:
   - Metadata tổng thể: Thời gian vào hàng đợi, thời điểm bắt đầu, thời gian thực thi tổng cộng.
   - Bảng Node Execution Logs: Xem chính xác node nào bị fail và mã lỗi an toàn (`errorCode` như `CONNECTOR_TIMEOUT`, `RATE_LIMIT_EXCEEDED`, `OWNER_SUSPENDED`, `NODE_TYPE_DISABLED`).
4. **Quy tắc bảo mật**: Admin không cần và không được yêu cầu người dùng cung cấp mật khẩu hay xem dữ liệu payload nhạy cảm. Mã lỗi chuẩn hóa đủ để kỹ sư hỗ trợ xác định nguyên nhân sự cố.

### 3.4. Kiểm toán và Tra cứu Nhật ký Quản trị
- Truy cập `/admin/audit-events`.
- Hỗ trợ giải trình và tuân thủ bảo mật:
  - Tra cứu ai đã khóa tài khoản của khách hàng X (`action = USER_SUSPENDED`).
  - Tra cứu ai đã tắt kết nối Google Sheets (`action = CONNECTOR_POLICY_CHANGED`).
  - Xem chi tiết diff Before vs After để nắm rõ trạng thái trước và sau khi Admin tác động.

---

## 4. Kế hoạch Sao lưu và Khôi phục (Backup & Rollback)

### 4.1. Sao lưu Cơ sở Dữ liệu
Trước mỗi đợt nâng cấp hoặc bảo trì lớn:
```powershell
# Tạo bản sao lưu PostgreSQL
pg_dump -h localhost -p 5433 -U postgres -d flowpilot -F c -b -v -f "flowpilot_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"
```

### 4.2. Quy trình Rollback
Trong trường hợp phiên bản ứng dụng mới gặp sự cố không thể khắc phục ngay:
1. **Rollback Ứng dụng**: Triển khai lại bản build backend và frontend trước đó.
2. **Cơ sở Dữ liệu**:
   - **Tuyệt đối không chạy `migrate reset` hay drop database**.
   - Các bảng mới `connector_policies` và `node_type_policies` hoàn toàn độc lập và không ảnh hưởng đến mã nguồn backend phiên bản cũ.
   - Phiên bản backend cũ tiếp tục chạy bình thường trên schema hiện tại.

---

## 5. Danh mục Mã lỗi Chuẩn hóa cho Vận hành

| Mã lỗi (Error Code) | Ý nghĩa vận hành | Hướng dẫn xử lý |
| --- | --- | --- |
| `OWNER_SUSPENDED` | Workflow bị hủy vì chủ sở hữu tài khoản đang bị khóa | Kiểm tra trạng thái tài khoản tại `/admin/users`; mở khóa nếu tài khoản đã giải quyết xong vi phạm |
| `CONNECTOR_NEW_CREDENTIALS_DISABLED` | Người dùng cố gắng tạo kết nối mới với connector đang bị tạm ngừng | Kiểm tra chính sách connector tại `/admin/connectors`; bật lại nếu dịch vụ ngoài đã ổn định |
| `NODE_TYPE_DISABLED` | Node bị dừng chạy vì Admin đã tắt quyền thực thi | Kiểm tra cấu hình node tại `/admin/node-types`; bật lại cờ `isExecutionAllowed` khi node an toàn |
| `STALE_REVISION` | Xung đột cập nhật đồng thời giữa hai Admin | Tải lại trang web để nhận dữ liệu mới nhất trước khi thực hiện lại thao tác |
| `LAST_ACTIVE_ADMIN` | Hệ thống ngăn chặn hạ quyền hoặc khóa Admin active cuối cùng | Bắt buộc phải nâng quyền một Admin khác trước khi hạ quyền tài khoản hiện tại |
| `UNCLASSIFIED_ERROR` | Lỗi ngoại lệ runtime chưa được chuẩn hóa mã | Kiểm tra log chi tiết cấp máy chủ tại backend container |
