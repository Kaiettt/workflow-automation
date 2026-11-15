# Checklist: Dashboard Vận hành (Admin Dashboard)

Status: completed (PR #39)

- [x] G3.1 Bổ sung cột `error_code` và `cancellation_reason` trong cơ sở dữ liệu để chuẩn hóa mã lỗi execution/node.
- [x] G3.2 Xây dựng hàm `safeExecutionErrorCode()` chuyển đổi lỗi lịch sử hoặc chưa phân loại về `UNCLASSIFIED_ERROR`, ngăn chặn lộ raw message.
- [x] G3.3 Triển khai `AdminReadPort.dashboard()` trong `PrismaAdminRead` thực hiện snapshot tài khoản/workflow và aggregate execution trong transaction Repeatable Read.
- [x] G3.4 Viết raw SQL query nhóm ngày theo múi giờ `queued_at AT TIME ZONE timezone` và khoảng nửa mở `[from, to)`.
- [x] G3.5 Cài đặt công thức tính tỷ lệ thành công `SUCCESS / (SUCCESS + FAILED) * 100`, loại trừ CANCELLED và xử lý trả về null khi mẫu số 0.
- [x] G3.6 Viết `DashboardDto` với validation khoảng cách tối đa 90 ngày và kiểm tra timezone hợp lệ qua `Intl.DateTimeFormat`.
- [x] G3.7 Tạo endpoint `GET /api/admin/dashboard` trong `AdminController`.
- [x] G3.8 Xây dựng `DashboardPage.tsx`, `DashboardRangeFilter.tsx` (chọn nhanh 24h, 7d, 30d, custom) và các `MetricCard.tsx`.
- [x] G3.9 Xây dựng `ExecutionPanels.tsx` hiển thị biểu đồ xu hướng thực thi và bảng phân nhóm lỗi an toàn.
- [x] G3.10 Cài đặt visible-only polling 30 giây trong hook `useAdmin` (dừng khi `document.visibilityState === 'hidden'`).
- [x] G3.11 Viết unit và integration tests kiểm chứng AC-DB-01 đến AC-DB-05 (tỷ lệ 75%, mẫu số 0, timezone boundary, safe error fallback, visible polling).
