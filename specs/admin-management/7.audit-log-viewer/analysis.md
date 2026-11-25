# Phân tích chức năng G7: Nhật ký quản trị

Ngày phân tích: 2026-11-24. Phạm vi: nghiên cứu yêu cầu và mã nguồn; đề xuất trong tài liệu chưa phải đặc tả được phê duyệt để triển khai.

Ghi chú: đây là phân tích trước triển khai. Contract đã được chốt trong [spec.md](spec.md); hiện trạng triển khai và kết quả kiểm tra mới nhất được theo dõi trong [task.md](task.md).

Nguồn chính: [spec G7](spec.md), [design G7](design.md), [plan](plan.md), [task](task.md), [Admin spec](../spec.md), [Admin design](../design.md), [SRS](../../../docs/srs.md).

## 1. Mục tiêu và đối tượng sử dụng

G7 giúp Admin trả lời: ai đã thay đổi tài khoản/chính sách, thay đổi lúc nào, tác động lên tài nguyên nào, lý do là gì và trạng thái trước/sau khác nhau như thế nào. Trong ngôn ngữ miền của FlowPilot, đây là **Nhật ký quản trị**.

Nguồn: [CONTEXT.md](../../../CONTEXT.md), [G7 spec, mục 1](spec.md), [Admin spec, FR-AD-13](../spec.md).

| Ngữ cảnh | Hành vi cần có |
| --- | --- |
| Admin active, JWT/session hợp lệ | Tra cứu list/detail toàn nền tảng |
| Client | Backend từ chối quyền đọc API Admin |
| Chưa xác thực hoặc session bị thu hồi | Backend từ chối request |
| Sự kiện do CLI tạo | Hiển thị actor SYSTEM; actorId có thể null |

Nguồn: [Admin spec, mục 12](../spec.md), [G7 spec, FR-AL-02](spec.md). Viewer chỉ đọc dữ liệu đã được các mutation nghiệp vụ ghi nhận.

## 2. Nhóm chức năng và luồng sử dụng

| Nhóm chức năng | Contract được yêu cầu | Giá trị nghiệp vụ |
| --- | --- | --- |
| Danh sách | GET /api/admin/audit-events; page/pageSize, mặc định 20, tối đa 100; createdAt desc/id desc | Tra cứu các thay đổi mới nhất |
| Bộ lọc | actorId, actorType, action, targetType, targetId, from/to | Thu hẹp theo người, hành động và tài nguyên |
| Chi tiết | GET /api/admin/audit-events/:id; actor, target, thời điểm, lý do, before/after | Giải trình một thay đổi cụ thể |
| Diff | Bảng thuộc tính / trước / sau; nổi bật giá trị thay đổi | Hiểu tác động thay vì đọc JSON thô |
| Bất biến và atomic | Không có API sửa/xóa; mutation và audit cùng transaction | Bảo toàn độ tin cậy của lịch sử |

Nguồn: [G7 spec, FR-AL-01–05](spec.md), [G7 design, mục 3](design.md).

Luồng tra cứu: Admin mở `/admin/audit-events` → áp dụng bộ lọc → đọc danh sách có phân trang → mở “Xem chi tiết” → dialog tải event theo ID → xem lý do và diff → đóng dialog, tiếp tục danh sách với bộ lọc hiện tại.

Luồng kiểm toán theo tài nguyên: chọn targetType/targetId → xem chuỗi thay đổi mới nhất trước → mở từng event để đối chiếu trạng thái tại thời điểm được ghi nhận. Diff của một event dùng chính before/after của event đó.

Nguồn: [Admin spec, mục 11](../spec.md), [G7 design, AuditEventsPage/AuditDiffDialog](design.md). Việc giữ filter/page khi đóng dialog là đề xuất cần đưa vào scenario.

## 3. Sáu loại sự kiện và dữ liệu thực tế

| Action | Actor/target | Nội dung before/after hiện có |
| --- | --- | --- |
| USER_SUSPENDED | ADMIN → USER | role, isActive |
| USER_REACTIVATED | ADMIN → USER | role, isActive |
| USER_ROLE_CHANGED | ADMIN → USER | role, isActive |
| ADMIN_BOOTSTRAPPED | SYSTEM → USER; actorId null | CLI: role/isActive tài khoản đã có → ADMIN/true; development seed tạo account mới: before {}, after ADMIN/true |
| CONNECTOR_POLICY_CHANGED | ADMIN → CONNECTOR | allowNewCredentials, revision |
| NODE_TYPE_STATUS_CHANGED | ADMIN → NODE_TYPE | key, isCatalogVisible, isExecutionAllowed, revision |

Nguồn: [account/CLI bootstrap writer](../../../monolith-backend/libs/auth/src/infrastructure/persistence/prisma-account-administration.ts), [development Admin seed](../../../monolith-backend/prisma/seed-development-admin.ts), [connector writer](../../../monolith-backend/libs/connector/src/infrastructure/persistence/prisma-connector-policy.repository.ts), [node-type writer](../../../monolith-backend/libs/node-library/src/infrastructure/persistence/prisma-node-type-policy.repository.ts).

CLI bootstrap nâng vai trò của tài khoản active đã đăng ký; before có trạng thái tài khoản đó. Development seed tạo tài khoản mới nên before là object rỗng. Hai dạng ADMIN_BOOTSTRAPPED hiện cùng tồn tại; diff phải giữ đúng dữ liệu event, không suy đoán {} thành role CLIENT/isActive false hoặc gán object rỗng cho CLI bootstrap.

G4/G5 đã ghi audit trong transaction. Mục G7.3 còn pending trong task và các nhãn “Mới” trong spec phản ánh tài liệu cũ; cần ưu tiên mã nguồn hiện tại khi xác định việc còn thiếu.

Nguồn: ba writer ở trên, [G7 task](task.md), [G7 spec, FR-AL-01](spec.md).

## 4. Hiện trạng và phần cần xây dựng

| Khu vực | Bằng chứng hiện trạng | Khoảng cách tới G7 |
| --- | --- | --- |
| Database | AdminAuditEvent đã có, before/after JSON và hai index | Chuẩn hóa projection/validation đọc; đối chiếu contract UUID/key |
| Ghi audit | Account/bootstrap, connector và node type đều có writer | Kiểm tra coverage/invariants, đồng bộ tài liệu; tránh tạo writer trùng |
| Backend đọc | AdminReadPort/AdminReadQuery chưa có auditEvents/auditEvent | Thêm typed filters/results và query adapter |
| HTTP | AdminController có guards Admin nhưng chưa có hai route audit | Thêm endpoints dưới auth/role hiện có |
| Frontend | Chưa có AuditEventsPage/useAdminAudit/AuditDiffDialog | Thêm list/filter/detail dialog, states và navigation |

Nguồn: [schema](../../../monolith-backend/prisma/schema.prisma), [ReadPort](../../../monolith-backend/libs/admin/src/application/admin-read.port.ts), [Query](../../../monolith-backend/libs/admin/src/application/admin-read.query.ts), [Controller](../../../monolith-backend/libs/admin/src/presentation/admin.controller.ts), [admin service](../../../frontend/src/features/admin/services/admin.service.ts), [App routes](../../../frontend/src/App.tsx), [AdminLayout](../../../frontend/src/features/admin/components/AdminLayout.tsx).

Schema không khai báo relation từ actorId tới users. Không thể giả định có sẵn Prisma `include: { actor: true }`; adapter cần lookup/join rõ ràng. Với list, nên lookup theo tập actor IDs hoặc join trong một query để tránh N+1.

Nguồn: [AdminAuditEvent schema](../../../monolith-backend/prisma/schema.prisma), [G7 design, mục 1](design.md).

## 5. Quy tắc dữ liệu và hiển thị cần cụ thể hóa

**Identity và lịch sử.** Schema hiện lưu targetId dạng UUID; node-type writer ghi definition.id, trong khi API quản lý node type dùng key. UI nhập key vào targetId sẽ không khớp dữ liệu hiện tại. Đề xuất giữ targetId UUID và hiển thị key của node như metadata riêng khi contract được chốt.

Nguồn: [schema](../../../monolith-backend/prisma/schema.prisma), [node-type writer](../../../monolith-backend/libs/node-library/src/infrastructure/persistence/prisma-node-type-policy.repository.ts), [G7 spec, FR-AL-02](spec.md).

**Actor/target lookup.** Tên/email lấy từ bảng users là thông tin hiện tại. Metadata sự kiện vẫn phải giữ actorId/targetId/action/time gốc khi tên thay đổi hoặc lookup không còn kết quả. Đề xuất LEFT JOIN hoặc lookup có null fallback; SYSTEM hiển thị nhãn riêng, actor mất thông tin vẫn hiển thị ID. targetName nên được ghi rõ là tên hiện tại nếu chỉ join live data.

Nguồn: [G7 design, DTO detail và join](design.md), [schema](../../../monolith-backend/prisma/schema.prisma). Lưu tên lịch sử trong event là lựa chọn khác cần thay đổi đặc tả/dữ liệu; hiện chưa được yêu cầu.

**Before/after whitelist.** G7 spec liệt kê revision trong whitelist cho user, nhưng writer hiện không lưu revision trong JSON; node writer lại có thêm key ngoài danh sách whitelist G7. Cần chốt revision là trường bắt buộc cho sự kiện mới hay trường tùy chọn, cùng hợp đồng đọc tương thích lịch sử. Không lấy revision hiện tại của tài nguyên để gán cho sự kiện cũ. Đề xuất hiển thị trường thiếu là “Không ghi nhận” và giữ nguyên bản ghi lịch sử.

Nguồn: [G7 spec, FR-AL-02](spec.md), ba [writer account](../../../monolith-backend/libs/auth/src/infrastructure/persistence/prisma-account-administration.ts), [connector](../../../monolith-backend/libs/connector/src/infrastructure/persistence/prisma-connector-policy.repository.ts), [node type](../../../monolith-backend/libs/node-library/src/infrastructure/persistence/prisma-node-type-policy.repository.ts).

**Diff.** Đề xuất dùng bảng theo whitelist của từng action, so sánh các giá trị scalar đã validate. Phân biệt `false`, `0`, `null` và thuộc tính không được ghi nhận; revision/key giữ nguyên không được highlight như thay đổi. Before/after và reason cần render như text, không chèn HTML hoặc dump snapshot tùy ý.

Nguồn yêu cầu: [G7 spec, FR-AL-02/04](spec.md), [G7 design, Diff Viewer](design.md). Quy tắc missing/null/highlight là đề xuất, hiện chưa có scenario tương ứng.

**Query và thời gian.** from/to là khoảng nửa mở theo createdAt, tối đa 90 ngày. G7 chưa ghi mặc định khi bỏ một/hai mốc, validation from >= to, timezone bắt buộc, cách kết hợp filter và exact target lookup. Đề xuất AND, default 7 ngày, timestamp có timezone, detail ID không bị giới hạn bởi range list. Giới hạn độ dài range không đồng nghĩa xóa lịch sử quá 90 ngày.

Nguồn: [G7 spec, FR-AL-03](spec.md), [Admin spec, mục 12](../spec.md). Các mặc định nói trên cần được xác nhận, không phải yêu cầu đã có của G7.

**Polling và UI states.** Admin spec chung yêu cầu visible-only polling cho list và loading/empty/error có retry; G7 chưa định interval hoặc policy cho detail dialog. Có thể reuse pattern G6, đề xuất list 30 giây khi visible; detail tải khi mở, không cần polling bản ghi bất biến. Nút retry tải lại chỉ gọi GET.

Nguồn: [Admin spec, chuẩn mực UI](../spec.md), [G7 design, useAdminAudit](design.md), [hook G6](../../../frontend/src/features/admin/hooks/useAdminExecutions.ts).

**Phạm vi bất biến.** Migrations được đối chiếu mới có tạo bảng/index, chưa có trigger hoặc phân quyền database để ngăn UPDATE/DELETE audit. Không cung cấp HTTP mutation là yêu cầu có thể nghiệm thu ở API; chưa thể gọi database hiện tại là append-only/chống tamper. Nếu cần bảo vệ cả database, phải chốt thêm ranh giới quyền database và chính sách vận hành.

Nguồn: [migration Admin P0](../../../monolith-backend/prisma/migrations/20261114000000_admin_p0/migration.sql), [schema](../../../monolith-backend/prisma/schema.prisma), [G7 spec, FR-AL-05](spec.md).

## 6. Các điểm cần chốt trước triển khai

| Điểm chưa thống nhất | Bằng chứng | Hướng đề xuất |
| --- | --- | --- |
| targetId UUID hay key | Spec nói UUID/key; schema là UUID, G5 ghi definition.id | Giữ UUID, metadata key riêng; không đổi lịch sử âm thầm |
| User revision thiếu; node key thừa theo whitelist G7 | Writer hiện tại khác FR-AL-02 | Chốt per-action whitelist và cách hiển thị dữ liệu cũ |
| Actor/target tên hiện tại hay lịch sử | Design join live data, event chưa snapshot tên | Ghi rõ provenance, null fallback, bảo toàn event |
| Actor ID và target ID chưa có control UI | Spec/API có hai filter; design filter bar không liệt kê | Bổ sung picker/UUID input và reset page khi đổi filter |
| Action string tự do hay enum | DTO IsString; task nói enum, UI liệt kê sáu action | Chốt sáu action cho filter; quy tắc dữ liệu/action không nhận diện |
| DTO chưa đủ validation | Thiếu numeric transform; IsEnum dùng array; targetId không giới hạn | Reuse PageDto/IsIn, validate UUID/range/length tại HTTP |
| Default range và polling | G7 chỉ max90 ngày; parent yêu cầu polling list | Default/timezone/interval/lifecycle phải có scenario |
| “Bất biến 100%” ở phạm vi nào | FR-AL-05 mô tả không API sửa/xóa | Nghiệm thu quyền ghi qua API; DB chống tamper là quyết định riêng nếu cần |
| G7.3/tài liệu cha còn mô tả audit G4/G5 chưa có | Source đã có hai writer | Đồng bộ checklist theo hiện trạng, không implement trùng |
| Nguồn yêu cầu SRS | G7 dẫn FR-AD-05 (đổi role), SRS audit là FR-AD-11 | Sửa mapping nguồn trước phê duyệt spec |

Nguồn: [G7 spec](spec.md), [G7 design](design.md), [G7 task](task.md), [SRS](../../../docs/srs.md), [schema](../../../monolith-backend/prisma/schema.prisma) và writers ở mục 3. Đây là khoảng trống/mâu thuẫn contract; chưa kết luận cần thay đổi writer hoặc backfill dữ liệu lịch sử.

## 7. BDD và traceability đề xuất

G7 hiện có AC-AL-01–05 nhưng chưa có Given/When/Then với ID ổn định và mapping tới automated tests. Quy trình yêu cầu chốt hiểu biết/scenarios trước triển khai hành vi.

Nguồn: [workflow-coding](../../../docs/workflow-coding.md), [G7 spec, mục 3](spec.md).

| ID đề xuất | Given / When / Then rút gọn | Mapping / layer |
| --- | --- | --- |
| BDD-AL-01 | Có nhiều actor/action/target; kết hợp filters và phân trang; chỉ event khớp, total/sort đúng | AC-AL-01; PostgreSQL/HTTP |
| BDD-AL-02 | Event đúng from/to, cùng createdAt; truy vấn; gồm from, loại to và tie-break theo id | AC-AL-01; PostgreSQL/HTTP |
| BDD-AL-03 | UUID/enum/page/range không hợp lệ; gọi API; 400 trước truy vấn | FR-AL-03; HTTP |
| BDD-AL-04 | SYSTEM/null actor hoặc lookup actor/target mất; mở detail; giữ event và hiển thị fallback đúng | AC-AL-02; query/UI |
| BDD-AL-05 | Snapshot cũ thiếu revision, có false/0 hoặc extra key; mở diff; whitelist và biểu diễn missing đúng | AC-AL-02; projector/UI |
| BDD-AL-06 | Trường trạng thái đổi/giữ nguyên; xem diff; chỉ giá trị thay đổi được highlight | AC-AL-02; UI |
| BDD-AL-07 | Client/chưa login/session revoked; đọc hai API; từ chối; thử mutation/delete audit route không được cung cấp | AC-AL-03; HTTP |
| BDD-AL-08 | Audit insert bị lỗi trong từng mutation; gửi thay đổi; tài nguyên và audit đều không commit | AC-AL-04; PostgreSQL/HTTP |
| BDD-AL-09 | Sáu action có thay đổi hợp lệ; thực hiện; một event chuẩn hóa với before/after đúng whitelist | AC-AL-05; integration |
| BDD-AL-10 | No-op, stale revision, hoặc không có quyền; gửi mutation; không thêm event | FR-AL-05; integration |
| BDD-AL-11 | List/detail empty/404/network error; mở view/tải lại; thông báo đúng và chỉ GET | AC-AL-01/02/03; UI/HTTP |
| BDD-AL-12 | List visible/hidden rồi unmount; tiến clock; polling theo policy đã chốt và cleanup | Chuẩn UI chung; hook/browser |

Các seams phù hợp: API Admin/JWT + PostgreSQL riêng; public read projection/diff mapping; UI list/dialog và hook browser lifecycle. Không cần mở UI mutation mới để nghiệm thu viewer.

## 8. Thứ tự triển khai và phạm vi kiểm tra

1. Chốt target identity, per-action whitelist, dữ liệu lịch sử, lookup names, range/polling và các BDD; đồng bộ bốn artifact G7.
2. Reuse CQRS Admin: typed ReadPort/query, whitelist projection, list filters/pagination/snapshot và actor lookup theo batch/join.
3. Detail lookup, target metadata, null fallbacks và typed diff projector; không sửa bản ghi audit để phục vụ UI.
4. UI list/filter/dialog, UTC/local, loading/empty/error và lifecycle theo policy đã chốt.
5. Chạy coverage writer sáu action, no-op/revision/rollback và tests reader/UI; ghi evidence theo scenario.

Nguồn: [G7 plan](plan.md), [workflow-coding](../../../docs/workflow-coding.md). Các index cần đối chiếu query thực tế; hai index audit đã tồn tại, không thêm migration trùng mặc định.

Source tests đã có account/CLI bootstrap/no-op/rollback và concurrent development seed chỉ ghi một audit, reseed bảo toàn thay đổi tài khoản ở [admin-p0 integration](../../../monolith-backend/test/integration/admin/admin-p0.integration-spec.ts); node policy audit/no-op/rollback ở [node-types integration](../../../monolith-backend/test/integration/admin/node-types.integration-spec.ts). Sự tồn tại của test không chứng minh mọi AC viewer đã được nghiệm thu.

Connector có [command unit tests](../../../monolith-backend/test/unit/connector/commands/change-connector-policy.handler.spec.ts) và [fake policy/audit repository](../../../monolith-backend/test/support/connector/in-memory-connector-policy.repository.ts); trong source tests được đối chiếu chưa tìm thấy kiểm thử rollback connector bằng PostgreSQL. Cần bổ sung bằng chứng cho AC-AL-04 trên mutation này thay vì suy rộng từ account/node tests.

Chỉ tạo tài liệu phân tích; chưa thay đổi hành vi ứng dụng. Đã kiểm tra các liên kết nguồn trong file. Chưa chạy lint/type-check/test/build trong phần nghiên cứu này. Kết quả chạy kiểm tra mới, nếu có, cần được ghi riêng với command và phạm vi thực tế.
