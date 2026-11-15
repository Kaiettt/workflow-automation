# Tài liệu Đặc tả Quản trị Nền tảng (Admin Management Specs)

Thư mục này chứa toàn bộ tài liệu đặc tả, thiết kế kiến trúc, kế hoạch triển khai và checklist công việc cho hệ thống Quản trị (Admin) của FlowPilot.

Cấu trúc được chia nhỏ thành các thư mục đặc tả thành phần độc lập, được **đánh số theo đúng thứ tự triển khai** (mỗi thư mục bao gồm `spec.md`, `design.md`, `plan.md`, `task.md`):

---

## 1. Các Tính năng Đã Hoàn thành (Giai đoạn P0 - PR #39)

1. [1.admin-foundation/](1.admin-foundation/): Nền tảng truy cập, mô hình 2 role (`CLIENT` / `ADMIN`), bảo vệ cổng `/admin/*`, thu hồi phiên tức thì qua `session_version`, và bootstrap Admin đầu tiên qua CLI.
   - [spec.md](1.admin-foundation/spec.md) | [design.md](1.admin-foundation/design.md) | [plan.md](1.admin-foundation/plan.md) | [task.md](1.admin-foundation/task.md)
2. [2.user-management/](2.user-management/): Quản lý tài khoản người dùng, tìm kiếm, lọc, xem chi tiết, thống kê tài nguyên, khóa/mở khóa tài khoản (`isActive`), chuyển đổi vai trò (`role`), quy tắc bảo vệ last active admin, và tác động runtime (chặn webhook, hủy job queued).
   - [spec.md](2.user-management/spec.md) | [design.md](2.user-management/design.md) | [plan.md](2.user-management/plan.md) | [task.md](2.user-management/task.md)
3. [3.dashboard/](3.dashboard/): Dashboard vận hành tổng quan, snapshot tài khoản và workflow, aggregate số liệu execution trong 90 ngày, tính toán tỷ lệ thành công (75% mẫu chuẩn), biểu đồ xu hướng theo ngày và múi giờ, phân nhóm mã lỗi an toàn, visible-only polling 30 giây.
   - [spec.md](3.dashboard/spec.md) | [design.md](3.dashboard/design.md) | [plan.md](3.dashboard/plan.md) | [task.md](3.dashboard/task.md)

---

## 2. Các Tính năng Mới (Giai đoạn P1)

4. [4.connector-management/](4.connector-management/): Quản lý danh mục Connector, thống kê số credentials và số workflow liên kết, chính sách `allowNewCredentials` (bảo toàn 100% credential cũ và workflow đang chạy), hỗ trợ API Key, Google OAuth và Package OAuth2, xử lý race condition ở callback, bảng riêng `connector_policies` chống ghi đè khi restart/sync catalog.
   - [spec.md](4.connector-management/spec.md) | [design.md](4.connector-management/design.md) | [plan.md](4.connector-management/plan.md) | [task.md](4.connector-management/task.md)
5. [5.node-type-management/](5.node-type-management/): Quản lý danh mục loại node, phân tách 2 cấp độ kiểm soát: Ẩn khỏi palette Designer (`isCatalogVisible`) và Chặn thực thi runtime (`isExecutionAllowed`), thống kê workflow sử dụng, bảo toàn tính tương thích ngược, bảng riêng `node_type_policies` chống ghi đè khi restart/sync catalog.
   - [spec.md](5.node-type-management/spec.md) | [design.md](5.node-type-management/design.md) | [plan.md](5.node-type-management/plan.md) | [task.md](5.node-type-management/task.md)
6. [6.execution-monitoring/](6.execution-monitoring/): Giám sát thực thi toàn nền tảng, bộ lọc đa chiều (owner, workflow, execution ID, status, trigger, time range), projection metadata an toàn (Privacy Whitelist: tuyệt đối không lộ payload, prompt, secret, stack trace), bảng tiến trình node execution logs, giao diện 100% Read-only (không có nút Run/Retry/Cancel), visible-only polling 30 giây.
   - [spec.md](6.execution-monitoring/spec.md) | [design.md](6.execution-monitoring/design.md) | [plan.md](6.execution-monitoring/plan.md) | [task.md](6.execution-monitoring/task.md)
7. [7.audit-log-viewer/](7.audit-log-viewer/): Trình tra cứu nhật ký kiểm toán quản trị, bộ lọc actor/action/target/thời gian, phân trang và sắp xếp mới nhất trước, hiển thị trực quan bảng đối chiếu Diff Before vs After các trường whitelist, tính bất biến 100% (không có API sửa/xóa), ghi nhận atomic cùng transaction mutation.
   - [spec.md](7.audit-log-viewer/spec.md) | [design.md](7.audit-log-viewer/design.md) | [plan.md](7.audit-log-viewer/plan.md) | [task.md](7.audit-log-viewer/task.md)

---

## 3. Tài liệu Tổng hợp và Vận hành Toàn cục

- [spec.md](spec.md): Tổng hợp yêu cầu chức năng (FR-AD-01 đến FR-AD-13) và 28 Tiêu chí nghiệm thu (AC-01 đến AC-28).
- [design.md](design.md): Tổng thể kiến trúc Clean Architecture & CQRS, schema database, DTO whitelist và ma trận bảo mật.
- [plan.md](plan.md): Lộ trình triển khai tổng thể từ G0 đến G8.
- [task.md](task.md): Checklist tổng hợp toàn bộ các giai đoạn.
- [analysis.md](analysis.md): Phân tích nghiệp vụ, ranh giới quyền riêng tư dữ liệu Client, phân tích rủi ro và các câu hỏi mở.
- [validation.md](validation.md): Kết quả kiểm thử P0 (538 unit tests, 19 integration tests) và kịch bản kiểm thử chi tiết cho P1.
- [operations.md](operations.md): Sổ tay hướng dẫn migration, vận hành và xử lý sự cố.
