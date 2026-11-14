# Thiết kế Admin P0

Phạm vi đã triển khai: FR-AD-01 đến FR-AD-07 và phần ghi nhật ký tài khoản của FR-AD-11. Connector policy, màn hình execution toàn nền tảng và tra cứu nhật ký thuộc P1.

## Ranh giới module

`AdminController` gọi CQRS, không gọi Prisma trực tiếp. `libs/admin` giữ query/projection; Auth giữ use case thay đổi tài khoản qua `AccountAdministrationPort`, `ManageAccountCommand` và `SessionAccessPort`. Execution giữ enqueue/claim; Triggers giữ ingress webhook. Hạ tầng PostgreSQL thực hiện transaction và lock.

Frontend dùng `features/admin`, service HTTP và TanStack Query. Admin đăng nhập thành công mở dashboard; workspace có nút Quản trị và Admin có nút Về workspace. Route/menu chỉ hỗ trợ điều hướng; JWT và role hiện tại từ database quyết định quyền phía server. shadcn/ui cung cấp form, table, dialog, button, menu và chart.

## Contract và whitelist

| API | Projection hoặc input |
| --- | --- |
| `GET /api/admin/users` | `id`, `name`, `email`, `role`, `isActive`, `revision`, `createdAt`, `updatedAt`; pagination/search/filter phía server |
| `GET /api/admin/users/:id` | Metadata trên và `counts.workflows/credentials/executions`; execution đếm theo owner workflow |
| `GET /api/admin/users/:id/workflows` | `id`, `name`, `status`, `active`, `updatedAt`; pagination |
| `PATCH .../active` | `isActive`, `reason`, `expectedRevision` |
| `PATCH .../role` | `role`, `reason`, `expectedRevision` |
| Mutation response | Metadata cập nhật, revision và `auditEventId`; no-op trả ID null |
| `GET /api/admin/dashboard` | Snapshot account/workflow; aggregate execution, success rate, trend, error groups; thời điểm cập nhật và khoảng truy vấn |

`AdminMutationFieldsGuard` kiểm tra field của raw body trước global whitelist pipe, để field như `actorId` không bị âm thầm bỏ qua. DTO kiểm tra kiểu, enum, reason trim 5–500 ký tự và revision không âm. Actor lấy từ phiên. ID/query/range không hợp lệ trả 400; chưa xác thực trả 401; Client trả 403 trước khi đọc tài nguyên.

Các lỗi nghiệp vụ 409: `SELF_ADMIN_CHANGE_FORBIDDEN`, `LAST_ACTIVE_ADMIN`, `TARGET_USER_INACTIVE`, `STALE_REVISION`. Không trả password, session version, refresh token, credential, workflow definition hoặc payload Client trong projection Admin.

## Schema và transaction

Migration `20261114000000_admin_p0` chuyển `DEVELOPER`/`BUSINESS_USER` thành `CLIENT`, giữ `ADMIN`, đổi default và thêm:

- `users.revision`, `users.session_version`: integer mặc định 0.
- `admin_audit_events`: actor type/ID, action, target type/ID, reason, before/after JSON theo whitelist, UTC timestamp; index theo thời điểm và target.
- `session_revocations`: user ID, session version, thời điểm tạo/hoàn tất; index các sự kiện chưa hoàn tất.
- `executions.error_code`, `executions.cancellation_reason`, `execution_node_logs.error_code`.

Không sửa các migration đã áp dụng hoặc xóa quan hệ/dữ liệu. Seed chỉ tạo user còn thiếu, giữ nguyên role, active, password và phiên của user đã tồn tại.

Mỗi account mutation lấy advisory transaction lock `7261101`, khóa actor/target theo thứ tự ID rồi kiểm tra lại actor, revision, invariant Admin và no-op. Thay đổi tăng revision/session version, ghi audit và outbox trong cùng transaction. Audit lỗi rollback toàn bộ. Hai Admin thay đổi đồng thời vẫn còn Admin active; retry revision cũ trả 409.

Bootstrap dùng cùng advisory lock, chỉ hoạt động khi chưa có Admin active và tài khoản đích đã đăng ký, active. Bootstrap tăng revision/session version và ghi `ADMIN_BOOTSTRAPPED` với actor SYSTEM/null. Không có public endpoint cấp Admin. Local seed có thể tạo Admin mẫu đầu tiên bằng transaction với cùng advisory lock và SYSTEM audit, chỉ trên database localhost khi NODE_ENV unset/development; account hiện có không bị reset. Quy trình đăng ký hiện tại xác minh email bằng OTP trước khi tạo user; schema hiện tại không có cờ email verification riêng.

## Phiên và runtime

Access/refresh JWT mang session version. JWT strategy đọc active/role/version hiện tại và từ chối token thiếu/sai version; refresh token không được dùng làm bearer access token. Mở khóa tăng version, không khôi phục phiên cũ.

Outbox worker retry mỗi 10 giây. Redis cleanup chỉ xóa token có version cũ, dùng compare-and-delete để giữ phiên mới đăng nhập. Database vẫn chặn token cũ trong thời gian Redis lỗi. Frontend hủy request/xóa cache khi logout hoặc đổi account; refresh trả về muộn không khôi phục account cũ.

Execution enqueue và claim lấy lock owner row cùng transaction với tạo execution/chuyển trạng thái. Claim của owner inactive chuyển `QUEUED` thành `CANCELLED`/`OWNER_SUSPENDED`, không gọi executor. Failure/stale hooks không ghi đè CANCELLED. Lượt đã RUNNING vẫn hoàn tất; workflow active/version giữ nguyên. Webhook vẫn acknowledge provider, bỏ sự kiện của owner inactive khỏi execution và test-event store. Mở khóa chỉ nhận sự kiện mới.

Stream execution kiểm tra phiên khi mở, sau khi lấy snapshot, trước khi phát event và mỗi heartbeat 15 giây; đóng và cleanup khi phiên không còn hợp lệ. Test-listen hiện tại dùng HTTP polling, mỗi request qua JWT guard; repo chưa có scheduler runtime riêng.

## Dashboard

PostgreSQL aggregate chạy trong transaction Repeatable Read. Account/workflow là snapshot hiện tại; execution dùng `queuedAt` trong `[from,to)`, UTC, tối đa 90 ngày. SQL nhóm ngày bằng timezone truy vấn; UI hiển thị giờ theo trình duyệt. Chọn nhanh 24 giờ/7 ngày/30 ngày và custom range; rolling range tiến theo thời gian ở mỗi lần tải lại.

Success rate là `SUCCESS / (SUCCESS + FAILED) × 100`; mẫu số 0 trả null. Cancelled đếm theo trạng thái, không vào nhóm lỗi. Mã lỗi được kiểm tra whitelist tại writer/projection; mã lịch sử/không nhận diện dùng `UNCLASSIFIED_ERROR`, không trả raw message. Nhóm fallback cùng mã được cộng lại.

Query keys chứa bộ lọc. Polling mỗi 30 giây chỉ khi trang đang hiển thị. Các trang có loading/empty/error và retry. Dialog account lưu snapshot/revision đã review khi mở; refetch không đảo tác động đang chờ xác nhận. Xung đột tải lại thông tin, không tự gửi lại mutation.

## Traceability

| Yêu cầu/AC | Kiểm chứng |
| --- | --- |
| FR-AD-01; AC-01/02/03/13 | HTTP authorization/registration; migration dữ liệu role cũ; ownership draft/version; AdminGuard và UserDropdown tests |
| FR-AD-02/03; AC-12/15 | Account metadata/search/pagination, automatic execution counts, projection không payload |
| FR-AD-04/05; AC-04/05/06/07/08 | Lock/unlock/demotion, concurrent mutations/enqueue/claim, worker cancellation, suspended webhook và no replay |
| FR-AD-06; AC-04/08 | Access/refresh version, Redis outbox retry, stream heartbeat; HTTP client late-refresh tests |
| FR-AD-11 phần tài khoản; AC-09 | Bootstrap SYSTEM audit, mutation audit rollback, revision/no-op |
| FR-AD-07; AC-12/14/15/16/17 | Aggregate fixtures 75%/null, UTC boundary/timezone, safe error fallback, UI empty/retry/range và visible polling |
| FR-AD-08/09/10, phần tra cứu FR-AD-11; AC-10/11 | P1, giữ theo plan; chưa triển khai trong P0 |

Kết quả kiểm tra thực tế và hạn chế xem [validation.md](validation.md); cách chạy/deploy xem [operations.md](operations.md).
