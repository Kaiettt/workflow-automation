# Checklist triển khai Admin

P0 (G0–G3) đã hoàn thành; G4/G5 và nghiệm thu toàn bộ MVP G6 thuộc P1, còn chờ triển khai. Kết quả: [validation](validation.md). Chi tiết phụ thuộc và cách kiểm tra: [plan](plan.md). Yêu cầu đích: [spec](spec.md).

## G0 — Thiết kế và baseline

- [x] G0.1 Viết design.md: DTO whitelist, schema, transaction boundary, mã lỗi và bảng traceability FR/AC.
- [x] G0.2 Chốt revision/session version, policy connector riêng và audit writer atomic.
- [x] G0.3 Rà ownership và toàn bộ đường start/enqueue/stream hiện có; giữ đường credential/OAuth trong phạm vi G4.
- [x] G0.4 Chuẩn bị fixture PostgreSQL/Redis test, ghi baseline checks hiện có.

## G1 — Role, phiên và nền tảng Admin (P0)

- [x] G1.1 Tạo migration hai role + revision/session version + audit schema; xác minh dữ liệu mới/cũ.
- [x] G1.2 Đồng bộ auth backend/frontend/seed/test fixture; public register từ chối role.
- [x] G1.3 Kiểm tra session version trên access/refresh token; thu hồi sau commit có retry.
- [x] G1.4 Tạo audit writer và bootstrap Admin nội bộ, serialize bootstrap và có SYSTEM audit.
- [x] G1.5 Wiring Admin module, default guards và API validation contract.
- [x] G1.6 Thêm AdminLayout/menu/route guard, bỏ role picker, cleanup auth/cache khi phiên hết hiệu lực.
- [x] G1.7 Kiểm tra AC-01, AC-02, AC-03, AC-13 và bootstrap/legacy token.

## G2 — Quản lý tài khoản (P0)

- [x] G2.1 User list/detail/workflow summary/counts với projection whitelist và pagination.
- [x] G2.2 User active/role commands: reason, revision/no-op, transaction lock, actor recheck, last Admin.
- [x] G2.3 User mutation + session version + audit atomic; rollback và retry refresh cleanup.
- [x] G2.4 Chặn owner inactive ở manual/enqueue/webhook/test trigger và schedule khi có.
- [x] G2.5 Claim queued atomic với owner gate; CANCELLED/OWNER_SUSPENDED không gọi executor.
- [x] G2.6 Bảo toàn running execution, workflow active và không replay khi mở khóa; không overwrite CANCELLED.
- [x] G2.7 Đóng/recheck tất cả stream riêng tư khi phiên bị thu hồi trong giới hạn spec.
- [x] G2.8 UsersPage/UserDetailPage và dialog hành động, reason/tác động, error/conflict/refetch.
- [x] G2.9 Kiểm tra AC-04 đến AC-09, AC-13, AC-15 bằng HTTP/DB/runtime và concurrency thật.

## G3 — Dashboard (P0)

- [x] G3.1 Mã lỗi an toàn/cancellation reason cho execution và node; fallback lịch sử không lộ raw message.
- [x] G3.2 Aggregate API: account/workflow snapshot, execution status/rate/trend/error groups.
- [x] G3.3 Timezone, khoảng [from,to), range validation và pagination/index khi cần.
- [x] G3.4 DashboardPage/filter/chart, query keys, visible-only polling, empty/error/retry.
- [x] G3.5 Kiểm tra AC-12, AC-14, AC-15, AC-16, AC-17.
- [x] P0 Đạt đầy đủ G1–G3 và bàn giao quản lý tài khoản + dashboard.

## G4 — Chính sách connector (P1)

- [ ] G4.1 Policy schema/repository/command, revision và audit; không dùng isActive.
- [ ] G4.2 Admin connector projection và counts distinct workflow/credential.
- [ ] G4.3 Policy gate cho API-key/form, Google OAuth và package OAuth2 start/callback.
- [ ] G4.4 Recheck policy trong transaction lưu credential, serialize với policy mutation.
- [ ] G4.5 Credential cũ vẫn đọc/chọn/chạy/gia hạn; seed/restart/package sync không ghi đè policy.
- [ ] G4.6 Catalog Client và ConnectorsPage/dialog có trạng thái và lý do rõ ràng.
- [ ] G4.7 Kiểm tra AC-07, AC-09, AC-10, AC-11, AC-12, AC-17.

## G5 — Execution và nhật ký (P1)

- [ ] G5.1 Admin execution list/detail/node metadata whitelist, filters và null semantics.
- [ ] G5.2 ExecutionsPage/ExecutionDetailPage, query keys và visible-only polling.
- [ ] G5.3 Audit list/API/AuditEventsPage; bootstrap SYSTEM, before/after whitelist và read-only.
- [ ] G5.4 Invalidate cache sau mutation, cleanup khi đổi account hoặc logout.
- [ ] G5.5 Kiểm tra AC-01, AC-12, AC-13, AC-15, AC-16, AC-17.

## G6 — Nghiệm thu và rollout

- [ ] G6.1 Hoàn tất AC-01 đến AC-17 và ghi kết quả kiểm thử thực tế.
- [ ] G6.2 Rehearsal migrate/seed/bootstrap trên DB test mới và dữ liệu cũ, kiểm tra restart/catalog sync.
- [ ] G6.3 Backend/frontend checks bắt buộc và smoke test UI/API.
- [ ] G6.4 Hướng dẫn deploy đồng bộ API/worker/frontend, invalidate phiên cũ và rollback tương thích.
- [ ] G6.5 Cập nhật spec/PRD/SRS theo implementation, bàn giao hướng dẫn vận hành và Admin đầu tiên.
