# Vận hành Admin P0

Các lệnh dưới đây chạy trong `monolith-backend`, nơi có Prisma CLI được pin theo project. Không dùng `npx prisma` ở thư mục gốc: nó có thể tải Prisma 8 ngoài version của repo.

## Migration và khởi động

```powershell
cd 'D:\New folder\workflow-automation\monolith-backend'
npx --no-install prisma migrate deploy
npx --no-install prisma generate
npm run build
```

Migration P0 đã được áp dụng vào `flowpilot` local tại `localhost:5433` ngày 2026-11-14. Migration giữ dữ liệu và chuyển hai role cũ thành Client. Token cũ thiếu session version hết hiệu lực sau rollout; đăng nhập lại.

Khi deploy môi trường khác, áp dụng migration trước khi chạy API/worker mới và triển khai frontend cùng release. Dừng worker phiên bản cũ trước khi nhận job mới để owner gate có hiệu lực. Không bật API cũ sau migration đổi enum; rollback ứng dụng cần bản tương thích hai role mới, không reset database.

## Đăng nhập Admin trên máy local

Seed đã tạo sẵn tài khoản local:

- Email: `admin@flowpilot.local`
- Mật khẩu ban đầu: `Admin123!`

Đăng nhập bằng form Sign In hiện có; Admin tự vào dashboard. Trong workspace có nút **Quản trị** trên thanh điều hướng và mục **Quản trị nền tảng** trong menu tài khoản. Trong Admin có nút **Về workspace**; không cần gõ URL thủ công.

`npm start`/`npm run start:dev` chạy seed và tạo Admin local đầu tiên nếu còn thiếu. Seed chỉ tạo trên database localhost khi NODE_ENV unset/development; không tạo trên production/test hoặc database remote. Account đã tồn tại giữ nguyên mật khẩu, role, active và revision/session version. Khi đã có Admin khác, seed không tự cấp thêm quyền.

## Cấp Admin đầu tiên trong môi trường khác

Đăng ký/xác minh email bằng luồng OTP hiện có, rồi dùng email của tài khoản đó:

```powershell
npm run admin:bootstrap -- 'email-cua-ban@example.com' 'Cấp Admin đầu tiên cho nền tảng'
```

Lệnh chỉ cấp quyền cho tài khoản đã tồn tại, active và khi chưa có Admin active. Lệnh ghi SYSTEM audit, vô hiệu hóa phiên cũ và in audit ID. Đăng nhập lại rồi mở `/admin` hoặc `/admin/users`. Khi đã có Admin active, thay role qua màn hình quản lý tài khoản với lý do và xác nhận.

Không có Admin/password mặc định cho production. Lệnh bootstrap không tạo tài khoản mới hoặc cho phép Client tự cấp quyền qua public API.

## Kiểm tra

```powershell
npm test -- --runInBand
npm run test:integration
```

Integration test đọc `.env` hoặc environment supplied, cần PostgreSQL cho phép tạo database test và Redis local khả dụng. Mỗi lần chạy tạo database `flowpilot_admin_test_<uuid>`, chạy migration cũ/mới, kiểm tra HTTP/runtime rồi dọn đúng database đó. Redis chỉ dọn token của user fixture trong database test. Test có tình huống cố ý làm audit insert lỗi để kiểm tra rollback; log ERROR trong tình huống đó là dự kiến.

Trong `frontend`:

```powershell
npm test
npm run build
```

Outbox `session_revocations` giữ các lần thu hồi chưa hoàn tất để retry mỗi 10 giây. Redis lỗi không làm token có session version cũ hợp lệ lại; khi Redis hoạt động, worker dọn token cũ và đánh dấu completed. Audit tài khoản lưu trong `admin_audit_events`; màn hình tra cứu audit thuộc P1.
