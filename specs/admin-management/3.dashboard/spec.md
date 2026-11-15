# Spec: Dashboard Vận hành (Admin Dashboard)

Status: completed (PR #39)

## 1. Mục tiêu và Bối cảnh
Cung cấp màn hình tổng quan giúp Quản trị viên nắm bắt nhanh chóng quy mô người dùng, tình hình workflow, khối lượng và tỷ lệ thực thi, xu hướng vận hành theo ngày và các nhóm lỗi phổ biến trên toàn nền tảng.

Nguồn yêu cầu: [SRS](../../../docs/srs.md) (FR-AD-04, FR-EX-06), [PRD](../../../docs/prd.md).

## 2. Yêu cầu Chức năng (Functional Requirements)

### FR-DB-01: Chỉ số Tổng quan Tài nguyên (Snapshot Metrics)
Dashboard hiển thị ảnh chụp hiện tại (snapshot) của toàn bộ tài nguyên:
- **Tài khoản (Users)**: Tổng số tài khoản, số Client đang active, số Client đang inactive, số Admin đang active.
- **Quy trình (Workflows)**: Tổng số workflow, số lượng theo trạng thái (`DRAFT`, `PUBLISHED`, `ARCHIVED`), và số workflow đang bật cờ `active = true`.
- Ghi chú giao diện: Ghi rõ đây là số liệu snapshot hiện tại của hệ thống, độc lập với bộ lọc thời gian của execution.

### FR-DB-02: Thống kê Thực thi (Execution Aggregates)
Thống kê các lượt chạy workflow trong khoảng thời gian nửa mở `[from, to)` căn cứ theo thời điểm vào hàng đợi (`queuedAt`):
- Đếm số lượt theo trạng thái: `QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, `CANCELLED`.
- **Tỷ lệ thành công (Success Rate)**:
  - Công thức: `SUCCESS / (SUCCESS + FAILED) * 100`.
  - Không tính các lượt `CANCELLED`, `QUEUED`, hay `RUNNING` vào mẫu số.
  - Khi mẫu số bằng 0 (chưa có lượt nào hoàn tất), hiển thị "Chưa có dữ liệu" thay vì 0%.

### FR-DB-03: Xu hướng Thực thi theo Ngày (Execution Trend)
- Thống kê số lượng execution theo từng ngày và phân loại theo trạng thái.
- Nhóm ngày theo múi giờ (`timezone`) do client gửi lên (sử dụng hàm SQL `to_char(queued_at AT TIME ZONE timezone, 'YYYY-MM-DD')`).
- Đảm bảo boundary nửa mở `[from, to)`: Lượt chạy tại đúng mốc `to` không được tính vào kết quả.

### FR-DB-04: Phân nhóm Lỗi An toàn (Safe Error Groups)
- Tổng hợp các execution có trạng thái `FAILED` theo mã lỗi chuẩn hóa (`errorCode`).
- Tuyệt đối không nhóm theo chuỗi thông điệp lỗi thô (`errorMessage` hay `errorStack`) để tránh rò rỉ thông tin nhạy cảm.
- Các lỗi lịch sử hoặc chưa được phân loại mã được gom nhóm dưới mã an toàn `UNCLASSIFIED_ERROR`.
- Các lượt bị hủy (`CANCELLED`) không được đưa vào bảng nhóm lỗi mà hiển thị ở thống kê trạng thái riêng.

### FR-DB-05: Bộ lọc Thời gian và Cơ chế Polling
- Bộ lọc thời gian:
  - Chọn nhanh: 24 giờ qua, 7 ngày qua (mặc định), 30 ngày qua.
  - Chọn khoảng tùy chỉnh: Tối đa 90 ngày.
- Cơ chế tự động cập nhật (Polling):
  - Tự động gọi API làm mới số liệu mỗi 30 giây.
  - Bắt buộc kiểm soát theo trạng thái hiển thị: Chỉ thực hiện polling khi tab trình duyệt đang mở (`document.visibilityState === 'visible'`). Dừng ngay lập tức khi tab bị ẩn hoặc chuyển sang tab khác.
  - Hỗ trợ nút "Làm mới" (Refresh) thủ công, trạng thái loading skeleton và error state có nút retry.

## 3. Tiêu chí Nghiệm thu (Acceptance Criteria)
- **AC-DB-01**: Tỷ lệ thành công tính chính xác theo công thức; tập mẫu 3 SUCCESS, 1 FAILED, 2 CANCELLED, 1 RUNNING cho kết quả 75%.
- **AC-DB-02**: Mẫu số bằng 0 hiển thị "Chưa có dữ liệu", không hiển thị 0%.
- **AC-DB-03**: Bộ lọc thời gian nửa mở `[from, to)` loại trừ chính xác bản ghi tại mốc `to`; nhóm ngày đúng múi giờ gửi lên.
- **AC-DB-04**: Bảng nhóm lỗi chỉ hiển thị mã lỗi an toàn; không chứa raw error message hay stack trace.
- **AC-DB-05**: Polling tự động tạm dừng khi ẩn tab trình duyệt và tự kích hoạt lại khi mở lại tab.
