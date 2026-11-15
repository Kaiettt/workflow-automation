# Kế hoạch Triển khai: Dashboard Vận hành (Admin Dashboard)

Status: completed (PR #39)

## 1. Mục tiêu và Phạm vi
Giai đoạn này (G3) tập trung xây dựng API tổng hợp số liệu vận hành và giao diện Dashboard trực quan cho Quản trị viên, phục vụ theo dõi sức khỏe hệ thống.

## 2. Các Bước Triển khai Đã Hoàn thành

1. **Chuẩn hóa Mã lỗi ở Engine**:
   - Thêm cột `error_code` vào `executions` và `execution_node_logs`.
   - Cập nhật các executor và engine mapper để gán mã lỗi an toàn khi có sự cố.
   - Xây dựng fallback `safeExecutionErrorCode()` để chuyển các lỗi lịch sử chưa phân loại về `UNCLASSIFIED_ERROR`.
2. **Backend Aggregate Query**:
   - Triển khai `AdminReadPort.dashboard()` trong `PrismaAdminRead`.
   - Viết các câu lệnh Prisma groupBy và raw SQL query nhóm ngày theo timezone trong transaction Repeatable Read.
   - Tính toán tỷ lệ thành công theo đúng công thức loại trừ cancelled và xử lý mẫu số 0.
3. **Controller & Validation**:
   - Viết `DashboardDto` validate ISO8601 strings và timezone.
   - Thêm endpoint `GET /api/admin/dashboard` trong `AdminController`.
4. **Frontend UI & Visualizations**:
   - Tạo `DashboardPage.tsx`, `DashboardRangeFilter.tsx`, `ExecutionPanels.tsx`.
   - Xây dựng biểu đồ xu hướng ngày và bảng phân nhóm lỗi an toàn.
   - Cài đặt cơ chế visible-only polling 30 giây với TanStack Query.
5. **Kiểm thử**:
   - Viết unit tests kiểm tra công thức tính tỷ lệ thành công và xử lý mẫu số 0.
   - Viết integration tests kiểm tra boundary nửa mở `[from, to)` và nhóm múi giờ.
   - Viết frontend test kiểm tra trạng thái loading, empty state, và polling tự dừng khi ẩn tab.
