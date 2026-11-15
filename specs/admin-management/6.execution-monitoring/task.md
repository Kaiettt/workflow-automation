# Checklist: Giám sát Execution Toàn Nền Tảng (Execution Monitoring)

Status: ready-for-agent (P1)

- [ ] G6.1 **Database Indexing**: Bổ sung composite index `executions(queued_at, status)` và `executions(workflow_id, queued_at)` trong `prisma/schema.prisma`.
- [ ] G6.2 **Admin Execution Projection**:
  - Triển khai `AdminReadPort.executions()` và `AdminReadPort.execution(id)` trong `PrismaAdminRead`.
  - Cài đặt `select` tĩnh theo whitelist an toàn: Tuyệt đối không chọn `input`, `output`, `context`, `errorMessage`, `errorStack`, custom node label.
  - Chuẩn hóa mã lỗi an toàn fallback `UNCLASSIFIED_ERROR`.
- [ ] G6.3 **Presentation Endpoints**:
  - Viết `AdminExecutionFilterDto` với validation phân trang và khoảng thời gian tối đa 90 ngày.
  - Thêm endpoint `GET /api/admin/executions` và `GET /api/admin/executions/:id` trong `AdminController`.
- [ ] G6.4 **Frontend Types & Service**: Cập nhật `admin.types.ts` và `admin.service.ts` với execution DTOs và API methods.
- [ ] G6.5 **Visible Polling Hook**: Xây dựng hook `useAdminExecutions.ts` tự động refetch mỗi 30 giây khi tab hiển thị, dừng khi tab bị ẩn.
- [ ] G6.6 **Frontend Components**:
  - Tạo `ExecutionFilterBar.tsx` (bộ lọc owner, workflow, execution ID, status, trigger, time range).
  - Tạo `ExecutionTable.tsx` (bảng danh sách, badges, timing, mã lỗi).
  - Tạo `NodeLogsTimeline.tsx` (tiến trình các node log an toàn).
- [ ] G6.7 **Frontend Pages**:
  - Tạo `ExecutionsPage.tsx` và `ExecutionDetailPage.tsx`.
  - Đảm bảo giao diện hoàn toàn chỉ đọc (không có nút Run, Retry, Cancel).
- [ ] G6.8 **Kiểm thử G6**: Viết unit & integration tests cho AC-EM-01 đến AC-EM-05 (bộ lọc đa chiều, assertion không rò rỉ secret/prompt/payload, null semantics, visible polling).
