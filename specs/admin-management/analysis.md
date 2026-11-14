# Phân tích chức năng Admin của FlowPilot

Status: needs-triage

## 1. Mục tiêu nghiệp vụ

Admin cần quản lý tài khoản, nắm tình hình vận hành và kiểm soát khả năng sử dụng các kết nối dịch vụ của nền tảng. Client tiếp tục tự thiết kế và vận hành workflow thuộc quyền của mình. Hai vai trò không tạo ra quyền sở hữu chung đối với dữ liệu workflow.

Nguồn yêu cầu: [PRD](../../docs/prd.md), [SRS](../../docs/srs.md), [thuật ngữ](../../CONTEXT.md). Yêu cầu chi tiết và tiêu chí nghiệm thu nằm trong [spec](spec.md); thứ tự thực hiện nằm trong [plan](plan.md).

## 2. Phân tích theo nhóm chức năng

| Nhóm | Vấn đề cần giải quyết | Phạm vi đề xuất | Ưu tiên |
| --- | --- | --- | --- |
| Quản lý tài khoản | Chưa có giao diện tra cứu, khóa tài khoản hoặc cấp quyền Admin | Danh sách, chi tiết, khóa/mở khóa, đổi Client ↔ Admin | P0 |
| Dashboard | Admin chưa biết quy mô sử dụng và tỷ lệ lỗi | Thống kê tài khoản, workflow, execution, xu hướng và nhóm lỗi theo mã | P0 |
| Quản lý connector | Cần tạm ngừng nhận kết nối mới với một dịch vụ | Tra cứu catalog, xem mức sử dụng, cho phép/chặn tạo credential mới | P1 |
| Theo dõi execution | Cần xác định Client/workflow đang gặp lỗi | Danh sách và chi tiết metadata, bộ lọc thời gian và trạng thái | P1 |
| Nhật ký quản trị | Cần biết ai thay đổi tài khoản hoặc chính sách connector | Ghi nhận thay đổi ngay từ P0; màn hình tra cứu ở P1 | P0/P1 |

P0 là phần triển khai trước; P1 thuộc phạm vi Admin MVP nhưng triển khai sau khi P0 ổn định.

## 3. Ranh giới quyền truy cập

Admin có thể đọc thông tin tài khoản và metadata vận hành của toàn nền tảng. Quyền này không tự động cho phép mở canvas, đọc snapshot version, input/output, execution context, raw error, token hoặc secret của Client.

Đề xuất này tiếp tục hướng đã trao đổi: quyền xem dữ liệu chi tiết để hỗ trợ Client cần một yêu cầu riêng. Trong Admin MVP, không có chức năng sửa, publish, chạy lại hoặc xóa workflow thay cho Client.

Admin vẫn có thể sử dụng các chức năng workflow với tài nguyên do chính mình sở hữu. Các endpoint dành cho Client tiếp tục kiểm tra ownership; quyền Admin không được dùng để bỏ qua kiểm tra này.

## 4. Các tình huống ảnh hưởng đến nghiệp vụ

### Khóa Client đang có workflow chạy tự động

Nếu chỉ chặn đăng nhập, webhook vẫn có thể gây phát sinh execution và chi phí. Đề xuất: khóa tài khoản chặn mọi lần chạy mới của workflow thuộc tài khoản đó, kể cả webhook/schedule. Lượt đang chờ không được bắt đầu; lượt đã chạy được hoàn tất để tránh ngắt giữa một thao tác với dịch vụ bên ngoài. Không xóa dữ liệu và không thay đổi lựa chọn bật/tắt workflow của Client.

Mở khóa khôi phục quyền truy cập và khả năng nhận sự kiện mới. Các sự kiện bị bỏ qua hoặc execution bị hủy khi khóa không được tự chạy lại.

### Tắt connector đang được sử dụng

`Connector.isActive` hiện được dùng để lọc catalog và tìm credential. Dùng trực tiếp trường này cho thao tác "chặn kết nối mới" có thể khiến credential đang tồn tại không còn truy cập được.

Đề xuất: chính sách nhận credential mới phải độc lập với trạng thái catalog/runtime. Chặn kết nối mới vẫn cho phép đọc, sử dụng và gia hạn credential đã có. Muốn dừng mọi workflow sử dụng một connector là chức năng khác, nằm ngoài MVP này.

### Thu hồi quyền Admin

Không thể chỉ thay nhãn trên giao diện hoặc chờ JWT hết hạn. Backend phải áp dụng quyền hiện tại khi xử lý request, vô hiệu hóa phiên cũ của tài khoản bị đổi quyền và bảo đảm luôn còn ít nhất một Admin active. Không cho Admin tự khóa hoặc tự đổi role trong MVP.

### Seed và đồng bộ catalog

Repo đang seed và đồng bộ catalog khi khởi động. Chính sách Admin đã lưu không được bị các bước này ghi đè. Đây là một tiêu chí tích hợp bắt buộc của quản lý connector.

## 5. Hiện trạng code và khoảng cách cần triển khai

| Khu vực | Hiện trạng quan sát được | Việc cần làm |
| --- | --- | --- |
| Role | Prisma, domain auth và frontend vẫn dùng `ADMIN`, `DEVELOPER`, `BUSINESS_USER` | Chuyển hai role cũ thành `CLIENT`, giữ `ADMIN`, cập nhật đăng ký/JWT/UI/test/seed |
| Tài khoản active | Login, refresh và JWT strategy có kiểm tra `isActive` | Bổ sung thao tác quản trị, vô hiệu hóa phiên và kiểm tra owner active ở luồng execution/trigger |
| Quyền Admin | Có `RolesGuard` và decorator role | Bổ sung endpoint Admin; quyền phải lấy từ trạng thái tài khoản hiện tại |
| Connector | Có catalog, credential cá nhân và `isActive` | Thêm chính sách nhận credential mới, áp dụng ở mọi đường tạo credential |
| Execution | Có record, trạng thái queue và node logs | Thêm projection metadata dành cho Admin, thống kê và mã lỗi an toàn |
| Giao diện | `frontend/src/App.tsx` chưa có route Admin | Thêm khu vực Admin, menu và route guard |
| Nhật ký quản trị | Chưa có model nhật ký quản trị trong Prisma schema | Bổ sung lưu trữ và tra cứu sự kiện quản trị |

Spec này mô tả hành vi đích; không xác nhận các chức năng trên đã được triển khai.

## 6. Thứ tự triển khai đề xuất

1. Chuyển role và bảo đảm ownership, đăng ký chỉ cấp Client, có quy trình cấp Admin đầu tiên.
2. Triển khai quản lý tài khoản cùng vô hiệu hóa phiên, quy tắc last Admin và nhật ký thay đổi.
3. Triển khai dashboard.
4. Triển khai chính sách connector, bảo toàn credential hiện có và chính sách qua lần khởi động lại.
5. Triển khai theo dõi execution và màn hình nhật ký quản trị.

Các quy tắc khóa tài khoản, phạm vi dữ liệu Admin và tác động connector ở trên là đề xuất cụ thể để review trong spec; chưa phải thay đổi runtime.
