# Checklist: Trình tra cứu Nhật ký Quản trị (Audit Log Viewer)

Status: ready-for-agent (P1)

- [x] G7.1 **Audit Schema & Infrastructure (P0)**: Bảng `admin_audit_events` và transaction-aware audit writer đã được tạo và kích hoạt cho các sự kiện tài khoản (`USER_SUSPENDED`, `USER_REACTIVATED`, `USER_ROLE_CHANGED`, `ADMIN_BOOTSTRAPPED`).
- [x] G7.2 **Audit Atomic Rollback (P0)**: Cơ chế rollback toàn bộ transaction khi ghi audit thất bại đã được cài đặt và kiểm thử thành công.
- [ ] G7.3 **Audit Action Alignment (P1)**: Kết nối ghi audit cho `CONNECTOR_POLICY_CHANGED` (từ G4) và `NODE_TYPE_STATUS_CHANGED` (từ G5).
- [ ] G7.4 **Admin Audit Query Implementation (P1)**:
  - Triển khai `AdminReadPort.auditEvents()` và `AdminReadPort.auditEvent(id)` trong `PrismaAdminRead`.
  - Join thông tin actor (`name`, `email`) từ bảng `users`.
  - Phân trang server-side, sắp xếp `createdAt desc`, `id desc`.
- [ ] G7.5 **Presentation Endpoints (P1)**:
  - Viết `AdminAuditFilterDto` với validation các enum action và khoảng thời gian tối đa 90 ngày.
  - Thêm endpoint `GET /api/admin/audit-events` và `GET /api/admin/audit-events/:id` trong `AdminController`.
- [ ] G7.6 **Frontend Types & Service (P1)**: Cập nhật `admin.types.ts` và `admin.service.ts` với audit DTOs và API methods.
- [ ] G7.7 **Frontend Components (P1)**:
  - Tạo `AuditEventFilterBar.tsx` (bộ lọc actor, action, target, thời gian).
  - Tạo `AuditEventTable.tsx` (bảng danh sách sự kiện, badges hành động, thời gian UTC/local).
  - Tạo `AuditDiffDialog.tsx` (hiển thị đối chiếu Before vs After JSON trực quan).
- [ ] G7.8 **Frontend Page (P1)**: Tạo `AuditEventsPage.tsx` tích hợp bảng kiểm toán, bộ lọc, phân trang và dialog xem diff chi tiết.
- [ ] G7.9 **Kiểm thử G7 (P1)**: Viết unit & integration tests cho AC-AL-01 đến AC-AL-05 (bộ lọc, join actor, diff Before/After, tính bất biến read-only).
