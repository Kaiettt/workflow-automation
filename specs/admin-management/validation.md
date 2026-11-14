# Nghiệm thu Admin P0

Ngày kiểm tra: 2026-11-14. P0 đã hoàn thành G0–G3 trong [checklist](task.md). P1 và nghiệm thu toàn bộ Admin MVP vẫn theo [plan](plan.md).

## Kết quả thực tế

| Kiểm tra | Kết quả |
| --- | --- |
| Backend `npm test -- --runInBand` | 37 suites, 538 tests passed |
| Backend `npm run test:integration` | 18 tests passed với PostgreSQL/Redis và HTTP |
| Backend ESLint toàn bộ `{src,apps,libs,test}` | 303 files; 0 errors, 0 warnings; dùng heap 4 GB theo script của repo |
| Backend Nest build | Thành công |
| Backend TypeScript production `tsc --noEmit -p tsconfig.build.json` | Thành công sau chỉnh điều kiện cấp quyền/no-op cuối |
| Frontend `npm test` | 44 files, 150 tests passed |
| Frontend test chi tiết tài khoản sau điều chỉnh inactive Admin | 4 tests passed |
| Frontend `npm run build` | Lint, TypeScript và Vite build thành công |
| Prisma local `migrate deploy` | Áp dụng `20261114000000_admin_p0` vào `flowpilot` tại localhost:5433, bảo toàn dữ liệu |

Build frontend còn cảnh báo kích thước JS bundle trên 500 kB; không làm build thất bại. Backend test cố ý gây audit insert lỗi để xác minh transaction rollback nên có log ERROR dự kiến.

## Các hành vi được kiểm tra

- Không đăng nhập trả 401; Client gọi API Admin trả 403; UI xác minh phiên hiện tại trước khi hiển thị nội dung Admin, kể cả local storage còn role Admin cũ.
- Public register từ chối role Admin, role cũ, null và chuỗi rỗng; không tạo account quyền cao. Mutation từ chối field thừa trước global whitelist.
- Rehearsal migration dữ liệu legacy: hai role cũ thành Client, Admin giữ nguyên, ownership workflow được giữ. Bootstrap chạy bằng lệnh nội bộ, có SYSTEM/null audit; lần bootstrap tiếp theo bị chặn.
- Search/pagination/projection chỉ metadata; Admin và Client không đọc draft/version người khác qua endpoint Client; không spoof owner khi tạo workflow.
- Account mutation đồng thời từ revision cũ chỉ một request commit; tự sửa bị chặn; hai Admin đồng thời hạ quyền nhau vẫn còn một Admin active.
- Khóa/đổi role thu hồi access/refresh cũ; mở khóa không khôi phục token; đăng nhập mới hoạt động. Hạ Admin xuống Client làm JWT cũ không dùng được; phiên mới chỉ có quyền Client.
- Inactive Admin có thể giữ nguyên role theo no-op hoặc hạ quyền; Client inactive không được cấp Admin. UI giữ nguyên snapshot/revision đã review trong dialog, kiểm tra reason trim và không tự retry mutation khi xung đột.
- Audit insert lỗi rollback; no-op không tạo audit; retry revision cũ trả 409. Redis cleanup lỗi vẫn chặn token bằng database version; outbox retry hoàn tất và không xóa phiên mới.
- Enqueue/claim đồng thời với khóa owner được serialize. Queued bị CANCELLED/OWNER_SUSPENDED trước executor, running hoàn tất, failure hook không ghi đè cancelled, workflow active giữ nguyên.
- Webhook của owner bị khóa được acknowledge, không enqueue hoặc lưu test payload. Mở khóa chỉ nhận sự kiện mới, không replay payload bị bỏ qua.
- Stream riêng tư không có sự kiện vẫn đóng ở heartbeat 15 giây sau khóa, trong giới hạn 30 giây.
- Dataset 3 SUCCESS/1 FAILED/2 CANCELLED/1 RUNNING cho tỷ lệ 75%; mẫu số 0 trả null. Automatic execution được đếm theo owner; boundary `to` bị loại và timezone nhóm đúng ngày.
- Dashboard response không có payload Client, kể cả mã lỗi chưa nhận diện; fallback `UNCLASSIFIED_ERROR`. UI có empty/error/retry/range validation và polling dừng khi trang bị ẩn.
- Refresh HTTP trả về muộn sau logout không khôi phục phiên; lỗi refresh của account trước không logout account mới.
- Seed chạy lại giữ nguyên trạng thái khóa, password, revision và session version của user đã có.

## Giới hạn của lần nghiệm thu

Kiểm tra bao gồm HTTP trên database test riêng, runtime worker/stream/webhook, component/form/polling qua Vitest và production builds. Chưa thực hiện kiểm tra bằng trình duyệt tương tác hoặc đo tải production. Root backend `tsc --noEmit` bao gồm toàn bộ test fixtures có lỗi kiểu tồn tại ở các test designer/node-config-resolver/node-execution-observer; production TypeScript và Jest đều qua. Không mở rộng P0 để refactor các fixture đó.

Chính sách connector, OAuth policy gates, màn hình metadata execution toàn nền tảng và tra cứu audit là P1; chưa đánh dấu hoàn thành. Hướng dẫn migration, bootstrap và chạy test xem [operations](operations.md).

## Cập nhật trải nghiệm đăng nhập local

Đã bổ sung Admin local `admin@flowpilot.local`, đăng nhập mở dashboard, nút Quản trị và Về workspace. Seed đã tạo account thật trên database local. Integration suite cập nhật: 19 tests passed; kiểm tra seed không chạy production, tạo đồng thời chỉ một account/SYSTEM audit, mật khẩu đăng nhập hoạt động và reseed giữ nguyên role/active/password/revision/session version. LoginForm/Navbar/AdminGuard: 14 tests passed. Frontend lint/TypeScript/Vite build thành công.

