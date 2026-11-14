# Plan triển khai chức năng Admin

Trạng thái: đã hoàn thành P0 (G0–G3). P1 (G4–G5) và nghiệm thu toàn bộ Admin MVP (G6) còn chờ triển khai. Xem [thiết kế](design.md), [kết quả kiểm tra](validation.md) và [hướng dẫn vận hành](operations.md).

Nguồn: [spec](spec.md), [phân tích](analysis.md), [checklist triển khai](task.md). Phạm vi chức năng và các AC-01 đến AC-17 giữ nguyên theo spec; plan cụ thể hóa thứ tự, nơi thay đổi và cách kiểm tra.

## 1. Các mốc bàn giao

| Giai đoạn | Ưu tiên | Kết quả bàn giao | Phụ thuộc |
| --- | --- | --- | --- |
| G0: Chốt thiết kế và baseline | Chuẩn bị | Contract, sơ đồ dữ liệu, transaction boundary và bộ kiểm tra baseline | Không |
| G1: Role, phiên và nền tảng Admin | P0 | Hai role, session validity, audit storage, bootstrap và cổng Admin | G0 |
| G2: Quản lý tài khoản | P0 | Account API/UI, khóa/mở khóa, đổi role và tác động execution | G1 |
| G3: Dashboard | P0 | Aggregate API, mã lỗi an toàn và màn hình thống kê | G1; kiểm tra cùng G2 trước bàn giao P0 |
| G4: Chính sách connector | P1 | Quản lý việc tạo credential mới trên mọi đường tạo/OAuth | G1; triển khai sau bàn giao P0 |
| G5: Execution và nhật ký | P1 | Projection metadata, màn hình tra cứu execution/audit | G1 và G3; triển khai sau bàn giao P0 |
| G6: Nghiệm thu và rollout | Hoàn tất MVP | Kiểm tra AC, rehearsal migration và hướng dẫn vận hành | G2 đến G5 |

G3 không cần chờ UI tài khoản hoàn thành; G4 và G5 có thể thực hiện độc lập khi contract đã ổn định. G2 và G3 cùng đạt tiêu chí mới bàn giao P0. Audit phải được ghi từ G1/G2, không chờ màn hình G5.

## 2. Ranh giới kiến trúc

- Tạo `monolith-backend/libs/admin`: HTTP API và các query/use case quản trị. Các controller chỉ nhận DTO, gọi CommandBus/QueryBus và trả DTO; không trực tiếp gọi Prisma hoặc repository nội bộ của module khác.
- **Auth** giữ thay đổi tài khoản, role, revision, session validity và quy tắc Admin active cuối cùng. Export use case/port ứng dụng cho Admin; không export domain entity để module khác tự sửa.
- **Connector** giữ chính sách credential mới và thao tác tạo credential. Các luồng OAuth trong Integrations đi qua public port của Connector.
- **Execution/Triggers** giữ kiểm tra owner và chuyển trạng thái queued/running/cancelled. Không dùng quyền Admin để bỏ qua ownership ở endpoint Client.
- **Admin** giữ các projection đọc theo whitelist và aggregate toàn nền tảng. Hạ tầng projection có thể đọc join cần thiết nhưng không trả entity/payload nguyên vẹn.
- Lưu audit cùng transaction PostgreSQL với mutation. Chốt transaction-aware audit writer ở hạ tầng Database/Audit, dùng qua port ứng dụng; không truyền Prisma transaction vào domain.
- Frontend thêm `features/admin/{api,services,hooks,types,components,pages}`; dùng HTTP client hiện có, TanStack React Query cho server state, local state cho form/dialog.

## 3. G0: Thiết kế contract và baseline

### Công việc

1. Ghi `design.md` với DTO whitelist, tên/mã lỗi, cấu trúc dữ liệu và transaction boundary. Đối chiếu toàn bộ FR-AD-01 đến FR-AD-11 và AC-01 đến AC-17.
2. Chọn `User.revision` kiểu integer tăng khi thay đổi tài khoản; `User.sessionVersion` kiểu integer tăng khi khóa/mở khóa hoặc đổi role. Access/refresh JWT mang `sessionVersion`; token thiếu hoặc sai version bị từ chối sau rollout.
3. Chọn bảng policy riêng theo `connector_id` với `allow_new_credentials`, `revision`, thời điểm cập nhật; không dùng `Connector.isActive` cho policy. Nếu chưa có row policy, connector khả dụng mặc định nhận credential mới.
4. Thiết kế `admin_audit_events`: actor type/ID, action, target, reason, timestamp và before/after whitelist. Actor bootstrap là SYSTEM với actor ID null. Audit không có endpoint sửa/xóa.
5. Thiết kế dữ liệu mã lỗi chuẩn hóa của execution/node và cancellation reason. Log lịch sử thiếu mã dùng `UNCLASSIFIED_ERROR`, không suy ra bằng cách gửi raw message cho Admin.
6. Chốt hai cơ chế đồng thời: revision chống ghi đè và transaction lock bảo vệ invariant. Không dùng kiểm tra `count(Admin)` ngoài transaction rồi cập nhật sau.
7. Rà mọi endpoint Client liên quan workflow/version/credential/execution để lập danh sách kiểm tra ownership và trường owner ID do client gửi. Bổ sung sửa các đường bypass được phát hiện vào G1/G2, không chỉ bảo vệ `/api/admin`.
8. Ghi baseline kiểm thử/typecheck/build hiện có của backend/frontend; dùng PostgreSQL/Redis dành riêng cho test. Ghi rõ lỗi có sẵn nếu có, không sửa lan sang tính năng khác.

### Điều kiện hoàn tất

Contract thống nhất giữa API, frontend và test; mọi AC có giai đoạn phụ trách. Có cách kiểm thử concurrency bằng hai request/transaction thật, không chỉ mock repository.

## 4. G1: Role, phiên và nền tảng Admin

### Backend và dữ liệu

1. Tạo migration mới để chuyển `DEVELOPER`, `BUSINESS_USER` → `CLIENT`, giữ `ADMIN` và các khóa ngoại; đổi default role. Không sửa SQL migration đã áp dụng, gồm file `20261110100424_` vừa khôi phục.
2. Bổ sung revision/session version, audit schema và index cần thiết. Chạy migration trên database test tạo mới và bản sao test có dữ liệu role cũ; so sánh số lượng/quan hệ trước và sau.
3. Đồng bộ `UserRole` ở Prisma/domain, mapper, register DTO/command, token DTO và seed. Public registration từ chối trường role; command luôn tạo Client kể cả được gọi qua đường khác.
4. JWT strategy so sánh session version với user hiện tại, tiếp tục kiểm tra active/role từ database. Refresh xác minh version, không cấp lại phiên đã bị thu hồi. Token thiếu version không được âm thầm nâng cấp.
5. Thu hồi refresh token sau commit bằng cơ chế có retry bền vững, ví dụ transaction outbox. Database session version vẫn là nguồn quyết định khi Redis lỗi.
6. Tạo Audit writer và bootstrap command nội bộ cho tài khoản đã có và đáp ứng điều kiện xác minh email của auth. Bootstrap tăng revision/session version, ghi SYSTEM audit; không tạo public endpoint cấp Admin.
7. Lệnh bootstrap lần đầu chỉ hoạt động khi chưa có Admin active, được serialize bằng khóa quản trị; tài khoản đích phải active. Nếu đã có Admin active, dùng luồng Admin đổi role thông thường.
8. Wiring module Admin vào API application, khai báo alias phù hợp và áp dụng JWT/role guard mặc định cho `/api/admin/*`.

### Frontend

1. Đổi auth type/store/profile label về Client/Admin; bỏ lựa chọn role khỏi RegisterForm và request đăng ký.
2. Thêm AdminLayout, navigation và route guard cho `/admin/*`. Xác minh hồ sơ trước khi dùng role lưu cũ để quyết định quyền truy cập; không flash nội dung Admin khi chưa xác minh.
3. Khi logout hoặc phiên bị thu hồi, hủy request/polling, xóa cache Admin và dữ liệu account cũ. Kiểm tra luồng HTTP client refresh hiện có không retry vô hạn sau `401`.
4. Tái sử dụng component shadcn/ui hiện có. Chỉ cài component thiếu bằng `npx shadcn@latest add <component-name>` trong `frontend/` khi bước UI tương ứng cần dùng.

### Kiểm tra và điều kiện hoàn tất

AC-01, AC-02, AC-03, AC-13 đạt; Client bị chặn ở API và route trực tiếp, Admin hợp lệ truy cập được. Migration giữ dữ liệu; bootstrap có audit; token role/version cũ không còn dùng được. Form đăng ký và đăng nhập hoạt động với hai role mới.

## 5. G2: Quản lý tài khoản và tác động runtime

### API/query

1. Triển khai danh sách user, chi tiết user và workflow summary theo các endpoint trong spec. Pagination/tìm kiếm/lọc thực hiện phía server; response dùng whitelist, có revision.
2. Account counts và execution filter dùng owner của workflow, bao gồm execution tự động có `triggeredById=null`.
3. Triển khai command đổi active và role với validation lý do, expectedRevision, no-op và mã lỗi thống nhất.

### Transaction và phiên

1. Mọi mutation ảnh hưởng role/active lấy cùng khóa quản trị trong transaction, rồi khóa các user row liên quan theo thứ tự ID ổn định. Recheck actor active/Admin ngay trong transaction trước khi thay đổi target.
2. Chặn tự khóa/tự đổi role, cấp Admin cho user inactive và làm mất Admin active cuối cùng. Recheck revision trước xử lý no-op; stale request trả `409`.
3. Mutation tăng revision/session version và append audit cùng transaction. Audit thất bại rollback; after-commit refresh cleanup retry không làm token cũ hợp lệ lại.
4. SSE/test-listen riêng tư gắn với version phiên khi mở. Kiểm tra lại khi phát dữ liệu và theo heartbeat tối đa 15 giây; đóng khi active/version không còn hợp lệ, cleanup subscription/timer. Áp dụng cho tất cả stream riêng tư hiện có, không chỉ Admin.

### Execution và Triggers

1. Dùng port ứng dụng Auth để nhận trạng thái owner cần thiết, không kéo domain user vào Execution/Triggers. Bổ sung gate cho manual start, enqueue, webhook, test trigger và đường schedule khi có runtime tương ứng.
2. Chốt thao tác enqueue và claim theo transaction lock trên cùng owner row mà lệnh khóa tài khoản cập nhật. Không tách `isActive` check khỏi transition `QUEUED` → `RUNNING`; thời điểm commit quyết định lượt thuộc trước hay sau khóa.
3. Nếu owner inactive khi claim: persist `CANCELLED`, `OWNER_SUSPENDED`, timing phù hợp và terminal event; worker kết thúc bình thường, không gọi executor. Failure/stale-job hooks không được ghi đè trạng thái CANCELLED thành FAILED.
4. Lượt đã RUNNING trước khóa tiếp tục hoàn tất. Không xóa workflow/credential/log, không đổi workflow active và không replay lượt đã hủy khi mở khóa.
5. Webhook của owner inactive vẫn handshake/ack theo provider nhưng không enqueue hoặc deliver payload vào test-event store. Giữ đúng behavior shared endpoint và dedup; không phát lại payload đã bỏ qua.

### UI

1. Tạo UsersPage, UserDetailPage, bảng/bộ lọc/phân trang và workflow summary.
2. Dialog khóa/mở khóa/đổi role dùng shadcn, có lý do và tác động trước/sau. Đợi server trả thành công mới invalidate queries; lỗi không giả lập cập nhật thành công.
3. Với `409`, tải lại revision và thông báo dữ liệu đã thay đổi; không tự gửi lại thay đổi trên revision mới mà không cho Admin xem.

### Kiểm tra và điều kiện hoàn tất

AC-04 đến AC-09, AC-13 và AC-15 đạt. Kiểm tra HTTP với PostgreSQL/Redis thật, worker và fake executor/provider để đếm side effect; hai Admin thao tác đồng thời; khóa đúng lúc enqueue/claim; Redis/audit lỗi; token cũ sau mở khóa; stream đóng trong 30 giây.

## 6. G3: Dashboard P0

### Công việc

1. Bổ sung ghi mã lỗi an toàn tại ranh giới lỗi engine/provider, cancellation reason tách riêng. Không thay định dạng payload log lịch sử hoặc đưa raw message vào projection.
2. Tạo AdminDashboard query port và PostgreSQL aggregate: account/workflow snapshot, execution theo `queuedAt`, trạng thái, success rate, nhóm lỗi FAILED và xu hướng ngày.
3. Validate `from`, `to`, timezone; khoảng `[from,to)`, tối đa 90 ngày. Group ngày theo timezone và trả thời điểm cập nhật/múi giờ cùng số liệu.
4. Tạo DashboardPage, bộ chọn nhanh 24 giờ/7 ngày/30 ngày, khoảng tùy chọn, cards và biểu đồ. Lấy aggregate API, không tải tất cả execution để đếm.
5. Đặt React Query keys gồm toàn bộ bộ lọc; polling 30 giây khi visible, loading/empty/error/retry rõ ràng; denominator 0 hiển thị không có dữ liệu.
6. Kiểm tra query plan trên dữ liệu test đại diện; thêm index khi query thực tế chứng minh cần. Không thêm hạ tầng analytics riêng cho MVP.

### Kiểm tra và điều kiện hoàn tất

AC-12, AC-14, AC-15, AC-16, AC-17 đạt với fixture số liệu và ranh giới thời gian/timezone. Chỉ số khớp nguồn dữ liệu; API không có payload Client. G2 và G3 cùng đạt để bàn giao P0.

## 7. G4: Connector policy P1

### Công việc

1. Tạo policy persistence, command thay policy và Admin connector projection. Policy record tách catalog để seed/package sync không ghi đè; policy revision có no-op/conflict giống user.
2. Số credential đếm row còn lưu. Số workflow distinct tính từ current published version, giải quyết connector qua node metadata/credential reference, kể cả LLM chọn provider bằng config. Không trả snapshot/config trong response Admin.
3. Tạo public Connector policy port; áp dụng cho API-key/form, Google OAuth và package OAuth2 start/callback. Provider network call nằm ngoài transaction.
4. Tại điểm lưu credential, transaction lấy lock theo connector/policy cùng lock mà policy mutation dùng, recheck availability/policy rồi lưu. Không dựa vào kết quả check ở OAuth start.
5. Phân biệt tạo credential mới với đọc, sử dụng, refresh/gia hạn credential đã có. Không đổi behavior credential cũ khi `allowNewCredentials=false`.
6. Policy mutation + revision + audit cùng transaction. Không bật nhận credential mới khi connector không khả dụng trong catalog/runtime.
7. Bổ sung trạng thái policy vào catalog response dành cho Client và phản hồi `CONNECTOR_NEW_CREDENTIALS_DISABLED` ở form/OAuth.
8. Tạo ConnectorsPage, search/filter/mức sử dụng và dialog đổi policy có lý do/tác động rõ ràng.

### Kiểm tra và điều kiện hoàn tất

AC-07, AC-09, AC-10, AC-11, AC-12, AC-17 đạt. Dùng callback OAuth/provider fake và DB thật để kiểm tra policy đổi giữa start/callback; mọi đường ghi credential bị chặn đúng; credential cũ vẫn dùng/gia hạn; seed và package sync giữ nguyên policy.

## 8. G5: Theo dõi execution và nhật ký P1

### Công việc

1. Tạo list/detail projection Admin execution và node theo whitelist trong spec. Không tái sử dụng DTO Client có payload rồi xóa field ở controller/frontend.
2. Bộ lọc owner, workflow, execution ID, status, trigger type và khoảng thời gian; pagination/order ổn định. Join owner từ workflow; field timing chưa có giữ null.
3. Tạo ExecutionsPage/ExecutionDetailPage, bộ lọc và node status table. Polling 30 giây khi visible; không có thao tác Run/Retry/Cancel hoặc mở canvas Client.
4. Tạo audit list query/API và AuditEventsPage. Filter actor/action/target/time, pagination, SYSTEM bootstrap hiển thị đúng; before/after chỉ có field đã whitelist.
5. Khi account/connector mutation thành công, invalidate query keys liên quan dashboard, detail/list và audit. Không trộn server data Admin vào Zustand.

### Kiểm tra và điều kiện hoàn tất

AC-01, AC-12, AC-13, AC-15, AC-16, AC-17 đạt. Fixture cố ý đặt secret/prompt/email trong input/output/raw message để chứng minh response không chứa các giá trị đó; ownership vẫn áp dụng khi Admin gọi endpoint Client.

## 9. G6: Nghiệm thu và rollout

1. Chạy tất cả AC-01 đến AC-17 qua các seam đã xác định; kiểm tra menu, route, paging, timezone, no-data và error flow trên UI. Không gọi vendor thật để kiểm chứng policy/side effect.
2. Rehearsal trên database test mới và snapshot test đã có dữ liệu: migrate, regenerate client, seed, bootstrap, login, account mutation, policy update và restart/catalog sync.
3. Chạy kiểm tra theo phạm vi đã đổi, sau đó bộ kiểm tra bắt buộc: backend test/build và frontend test/build. Ghi kết quả, lỗi baseline và hạn chế còn lại; không đánh dấu đạt nếu chưa chạy được test concurrency/runtime.
4. Chuẩn bị hướng dẫn deploy có trình tự: tạm ngừng API/worker/trigger ingress cũ → migration → generate/build/seed đã cập nhật → bootstrap Admin nếu cần → khởi động đồng bộ API/worker/frontend → smoke test.
5. Giữ queued executions, không reset database, không xóa workflow/credential. Worker mới đánh giá owner khi xử lý queue. Không chạy đồng thời binary dùng enum cũ với schema đã chuyển role.
6. Thông báo cần đăng nhập lại sau migration. Dùng backup/snapshot theo quy trình deploy hiện có; rollback theo bản sao staging hoặc bản build/schema tương thích đã rehearsal, không reset dữ liệu hay cố dựng lại phân biệt hai role cũ từ Client.
7. Cập nhật spec/checklist và PRD/SRS theo hành vi cuối cùng sau triển khai. Bàn giao log kiểm tra và hướng dẫn Admin đầu tiên.

### Điều kiện hoàn tất

Toàn bộ AC đạt; không có endpoint Admin mở cho Client, token cũ sống lại, policy bị seed ghi đè hoặc quyền Admin bypass ownership. Có migration đã rehearsal, bootstrap có audit và hướng dẫn vận hành.

## 10. Kế hoạch kiểm thử

| Nhóm | Seam | Kiểm tra trọng tâm |
| --- | --- | --- |
| Migration | Database test trước/sau | Role/default, dữ liệu/FK, legacy token, bootstrap |
| User mutation | HTTP + PostgreSQL + Redis test | Revision, last Admin, actor đổi quyền giữa request, audit rollback, session version |
| Runtime khóa account | Start/enqueue/worker/webhook/test-listen + executor fake | Không side effect sau gate, queued CANCELLED, running không bị hủy/replay |
| Connector | HTTP/OAuth callback + DB + provider fake | Check tại commit, credential cũ, sync/seed, mutation đồng thời |
| Read models | API/query trên fixture DB | Whitelist, số liệu, null, owner tự động, `[from,to)`, timezone |
| Frontend | Vitest + React Testing Library | Route/form/action, 401/403/409, cache cleanup, polling, empty/error |

Backend tests nằm trong `monolith-backend/test/{unit,integration,e2e,support}/`; frontend tests collocate trong `src/features/admin` hoặc `auth`. Unit test dùng fake port; concurrency và transaction invariants phải có integration test thật.

## 11. Nơi thay đổi chính

| Khu vực | File/thư mục hiện có hoặc dự kiến |
| --- | --- |
| Schema/migration/seed | `monolith-backend/prisma/` |
| Auth role/session/user command | `monolith-backend/libs/auth/src/` |
| Admin mới | `monolith-backend/libs/admin/src/`, API module wiring và alias config |
| Transaction/audit infrastructure | `monolith-backend/libs/database/src/`, module Audit được chốt trong design |
| Claim/enqueue/manual/stream | `monolith-backend/libs/execution/src/application/`, `infrastructure/queue/`, `infrastructure/persistence/` |
| Webhook/test trigger | `monolith-backend/libs/triggers/src/application/` |
| Credential/OAuth | `monolith-backend/libs/connector/src/`, `monolith-backend/libs/integrations/src/` |
| Catalog sync | `monolith-backend/libs/node-library/src/infrastructure/package-catalog.sync.ts`, seed scripts |
| Frontend | `frontend/src/features/admin/`, `features/auth/`, `shared/api/http-client.ts`, `App.tsx` |

Tên file mới theo chuẩn backend kebab-case, mỗi command/query một file cùng handler tương ứng; component React PascalCase. Đây là vị trí triển khai, không phải cam kết tạo abstraction dư thừa ngoài các seam cần thiết.
