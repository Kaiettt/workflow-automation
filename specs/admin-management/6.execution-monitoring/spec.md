# Spec: Giám sát Execution Toàn Nền Tảng (Execution Monitoring)

Status: ready-for-agent (P1)

## 1. Mục tiêu và Bối cảnh
Cung cấp khả năng theo dõi, tìm kiếm và tra cứu chi tiết các lượt thực thi workflow trên toàn hệ thống cho Quản trị viên, hỗ trợ kỹ thuật và chuẩn đoán lỗi nhưng tuân thủ nghiêm ngặt nguyên tắc bảo mật và quyền riêng tư (không bao giờ lộ payload, prompt, token, secret, stack trace của Client).

Nguồn yêu cầu: [SRS](../../../docs/srs.md) (FR-EX-*, FR-EM-*, FR-LG-*), [PRD](../../../docs/prd.md).

## 2. Yêu cầu Chức năng (Functional Requirements)

### FR-EM-01: Danh sách Execution Toàn Nền Tảng
- API `GET /api/admin/executions`:
  - **Bộ lọc đa chiều**:
    - `ownerId`: Lọc theo chủ sở hữu workflow (UUID).
    - `workflowId`: Lọc theo workflow (UUID).
    - `executionId`: Tìm chính xác theo mã lượt chạy (UUID).
    - `status`: Lọc theo trạng thái (`QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, `CANCELLED`).
    - `triggerType`: Lọc theo loại kích hoạt (`MANUAL`, `WEBHOOK`, `SCHEDULE`).
    - `from` và `to`: Khoảng thời gian nửa mở `[from, to)` căn cứ theo `queuedAt` (mặc định 7 ngày gần nhất, tối đa 90 ngày).
  - Phân trang server-side (`page`, `pageSize`, mặc định 20, tối đa 100), sắp xếp giảm dần theo thời gian vào hàng đợi (`queuedAt desc`, `id desc`).
  - **Safe Projection Danh sách**: Trả về ID, workflowId, tên workflow, ownerId, tên owner, email owner, versionId, số phiên bản (`versionNumber`), triggerType, status, queuedAt, startedAt, finishedAt, durationMs, mã lỗi an toàn (`errorCode`), lý do hủy (`cancellationReason`).

### FR-EM-02: Chi tiết Execution và Bảng Node Execution Logs
- API `GET /api/admin/executions/:id`:
  - Trả về thông tin metadata tổng quan của execution (như trên).
  - Danh sách bảng `nodeLogs` an toàn:
    - `nodeId`: ID của node instance trong workflow graph.
    - `nodeKey`: Key định danh loại node (ví dụ `integration.slack.postMessage`).
    - `status`: Trạng thái thực thi của node (`SUCCESS`, `FAILED`, `SKIPPED`, `RUNNING`).
    - `startedAt`, `finishedAt`, `durationMs`: Các mốc thời gian thực thi.
    - `retryCount`: Số lần thử lại.
    - `errorCode`: Mã lỗi chuẩn hóa an toàn (hoặc `null` nếu thành công).

### FR-EM-03: Nguyên tắc Bảo mật và Riêng tư Tuyệt đối (Privacy Whitelist)
- **Tuyệt đối không truy vấn và không trả về**:
  1. `Execution.input` và `Execution.output`.
  2. `Execution.context` (chứa biến môi trường và dữ liệu chạy workflow).
  3. `ExecutionNodeLog.input` và `output` (chứa dữ liệu gửi nhận của Client).
  4. `ExecutionNodeLog.errorMessage` thô và `ExecutionNodeLog.errorStack` (có thể in kèm access token, API key, đường dẫn nội bộ).
  5. Custom node label / node name do người dùng tự đặt (vì có thể chứa thông tin nhạy cảm).
  6. AI prompt hoặc tin nhắn đính kèm.
- **Xử lý mã lỗi an toàn**: Lỗi runtime chưa được phân loại mã phải dùng fallback an toàn `UNCLASSIFIED_ERROR`; không bao giờ lấy chuỗi `errorMessage` thô thay thế.

### FR-EM-04: Quy tắc Hiển thị và Giao diện Chỉ Đọc (Read-only Interface)
- **Xử lý Null**: Các trường thời gian chưa diễn ra (`startedAt`, `finishedAt`, `durationMs`) trả về `null`; giao diện hiển thị dấu gạch ngang "—", không hiển thị số 0ms giả lập.
- **Giao diện 100% Chỉ Đọc (Read-only)**: Khu vực Admin tuyệt đối không cung cấp các nút: Chạy (Run), Chạy lại (Retry), Hủy bỏ (Cancel), hoặc mở canvas chỉnh sửa workflow của Client.
- **Visible-only Polling**: Tự động làm mới danh sách/chi tiết mỗi 30 giây khi tab hiển thị; dừng ngay lập tức khi tab bị ẩn (`document.visibilityState === 'hidden'`).

## 3. Tiêu chí Nghiệm thu (Acceptance Criteria)
- **AC-EM-01**: Admin lọc execution theo owner, workflow, status, trigger và thời gian trả về kết quả chính xác và có phân trang.
- **AC-EM-02**: Response của `GET /api/admin/executions` và `:id` tuyệt đối không chứa payload, input/output, secrets hay stack trace.
- **AC-EM-03**: Execution tự động không có `triggeredById` vẫn lọc và hiển thị chính xác theo owner của workflow.
- **AC-EM-04**: Giao diện hoàn toàn chỉ đọc; không có nút can thiệp execution hay mở canvas Client.
- **AC-EM-05**: Cơ chế polling 30 giây tự động dừng khi tab bị ẩn và kích hoạt lại khi tab hiển thị.
