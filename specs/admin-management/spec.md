# Spec: Quản trị nền tảng FlowPilot

Status: ready-for-agent

Tiến độ: P0 đã triển khai và kiểm tra; P1 còn chờ triển khai. Chi tiết: [validation](validation.md), [design](design.md), [operations](operations.md).

## 1. Mục tiêu và nguồn yêu cầu

Xây dựng khu vực Admin để quản lý tài khoản, theo dõi tình hình sử dụng và kiểm soát việc tạo kết nối dịch vụ mới. Hệ thống chỉ có hai role `CLIENT` và `ADMIN`.

- [Phân tích chức năng](analysis.md)
- [Plan triển khai](plan.md) và [checklist](task.md)
- [PRD](../../docs/prd.md): đối tượng sử dụng và phạm vi quản trị.
- [SRS](../../docs/srs.md): FR-AU-01, FR-AU-07, FR-AU-09, FR-CF-07 và nhóm FR-AD.
- [Thuật ngữ](../../CONTEXT.md).

Các hành vi dưới đây là yêu cầu Admin MVP. P0 đã hoàn thành theo checklist; các yêu cầu P1 vẫn giữ nguyên để triển khai sau. Về role và đăng ký, PRD/SRS hiện tại cùng spec này thay thế yêu cầu chọn `DEVELOPER`/`BUSINESS_USER` trong spec authentication cũ.

## 2. Phạm vi và ưu tiên

| Phần | Ưu tiên | Kết quả |
| --- | --- | --- |
| Hai role và cổng truy cập Admin | P0 | Đăng ký chỉ cấp Client, mọi thao tác Admin được kiểm tra phía server |
| Quản lý tài khoản | P0 | Tra cứu, khóa/mở khóa, chuyển role |
| Vô hiệu hóa phiên và nhật ký thay đổi | P0 | Quyền thay đổi có hiệu lực và có thể truy vết |
| Dashboard | P0 | Số liệu và xu hướng vận hành có định nghĩa thống nhất |
| Quản lý connector | P1 | Cho phép/chặn tạo credential mới mà bảo toàn kết nối hiện có |
| Theo dõi execution | P1 | Tra cứu metadata toàn nền tảng, không lộ nội dung dữ liệu Client |
| Tra cứu nhật ký quản trị | P1 | Xem ai thay đổi tài khoản/chính sách connector |

P1 vẫn nằm trong Admin MVP; được triển khai sau P0.

Ngoài phạm vi: xóa tài khoản hoặc dữ liệu Client; giả lập đăng nhập Client; đọc/chỉnh sửa canvas, version snapshot, input/output hay credential của Client; chạy lại/dừng execution bằng thao tác Admin; thêm connector bằng code từ UI; thay auth type hoặc config schema của connector; quản lý secret hạ tầng; billing, tổ chức/team và phân quyền tùy biến; monitor CPU/RAM hoặc cảnh báo tự động.

## 3. Ma trận quyền

| Tài nguyên/thao tác | Client | Admin |
| --- | --- | --- |
| Workflow, version, credential và execution của chính mình | Theo chức năng hiện có và ownership | Theo cùng quy tắc ownership |
| Danh sách/chi tiết tài khoản trên nền tảng | Không | Metadata tài khoản, không có password/token |
| Khóa/mở khóa hoặc đổi role tài khoản khác | Không | Có, theo quy tắc mục 5 |
| Dashboard và metadata execution toàn nền tảng | Không | Có |
| Nội dung workflow/input/output của người dùng khác | Không | Không trong Admin MVP |
| Secret/credential của người dùng khác | Không | Không |
| Chính sách tạo credential mới theo connector | Chỉ xem trạng thái công khai | Xem và thay đổi |
| Nhật ký quản trị | Không | Chỉ đọc |

Admin không được dùng endpoint Client để vượt ownership. Projection Admin phải được tạo phía server theo danh sách field cho phép; frontend không nhận dữ liệu nhạy cảm rồi tự ẩn.

## 4. FR-AD-01: Truy cập Admin và chuyển đổi role

- `/admin/*` và `/api/admin/*` chỉ dành cho tài khoản active có role hiện tại là `ADMIN`.
- Không có phiên hợp lệ: API trả `401`. Client có phiên hợp lệ: API trả `403`. Menu Admin chỉ hiện cho Admin; route trực tiếp vẫn bị chặn.
- Backend dùng role/trạng thái hiện tại của tài khoản, không tin riêng claim role trong JWT cũ hoặc role gửi từ frontend.
- Public registration không có lựa chọn role. Request cố truyền trường `role` bị từ chối với `400`; tài khoản được tạo luôn là `CLIENT`.
- Chuyển dữ liệu hiện có: `DEVELOPER` và `BUSINESS_USER` thành `CLIENT`; `ADMIN` giữ nguyên. Không xóa user, workflow, version, credential hay execution. Prisma enum, domain enum, auth DTO, seed, frontend và các test fixture phải cùng dùng hai role mới.
- Sau rollout, phiên dùng mô hình role cũ hết hiệu lực và người dùng đăng nhập lại. Refresh không được cấp token với role cũ.
- Production cấp Admin đầu tiên qua lệnh quản trị nội bộ có kiểm tra tài khoản đích và ghi nhật ký; public API không cung cấp đường tự cấp Admin. Môi trường local có sẵn Admin mẫu do seed tạo kèm SYSTEM audit; seed không khôi phục mật khẩu/quyền/trạng thái đã thay đổi. Không dùng tài khoản/mật khẩu mặc định hardcode cho production.
- Admin đăng nhập thành công tự vào dashboard. Workspace có nút Quản trị và menu tài khoản để vào khu vực Admin; Admin có nút Về workspace để quay lại. Người dùng không cần nhập `/admin` thủ công.

## 5. Quản lý tài khoản

### FR-AD-02: Danh sách và tìm kiếm

- Hiển thị ID, tên, email, role, trạng thái active/inactive và thời điểm tạo.
- Tìm kiếm theo tên/email, không phân biệt hoa thường; lọc role và trạng thái; phân trang phía server.
- Mặc định mới nhất trước, dùng ID làm khóa phụ để thứ tự ổn định.
- Không trả password hash, token, OTP hoặc credential.

### FR-AD-03: Chi tiết tài khoản

- Hiển thị thông tin trong danh sách, thời điểm cập nhật và số workflow/credential/execution liên quan.
- Số execution theo tài khoản là execution của workflow tài khoản sở hữu, bao gồm lần chạy tự động không có `triggeredById`.
- Danh sách workflow tóm tắt chỉ gồm ID, tên, trạng thái publish/archive, cờ active và thời điểm cập nhật. Không có definition, mô tả tự do, config hoặc snapshot.
- Không sửa email, tên, mật khẩu hoặc dữ liệu workflow thay Client trong MVP này.

### FR-AD-04: Khóa và mở khóa

- Admin có thể khóa/mở khóa tài khoản khác; thao tác phải có lý do, xác nhận và kiểm tra trạng thái mới nhất phía server.
- Không tự khóa; không khóa Admin active cuối cùng; không xóa dữ liệu liên quan.
- Khóa có hiệu lực với login, refresh và request riêng tư bắt đầu sau khi thay đổi được commit.
- Với workflow của tài khoản bị khóa: chặn manual run, schedule, webhook và test trigger mới. Sự kiện webhook vẫn được acknowledge theo contract provider nhưng không enqueue hoặc lưu payload cho lần chạy sau.
- Worker kiểm tra owner trước khi chuyển lượt chờ sang `RUNNING`. Nếu owner inactive, chuyển lượt chờ thành `CANCELLED` với mã lý do `OWNER_SUSPENDED` và không gọi executor/dịch vụ ngoài.
- Lượt đã chuyển sang `RUNNING` trước thời điểm khóa được hoàn tất theo policy hiện tại. Khóa không hủy các tác động đã thực hiện.
- Giữ nguyên lựa chọn active/inactive workflow và version đã publish. Mở khóa cho phép nhận sự kiện mới theo cấu hình đó; không replay sự kiện đã bỏ qua hoặc lượt đã hủy.

### FR-AD-05: Thay đổi role

- Admin có thể chuyển tài khoản khác `CLIENT` ↔ `ADMIN` mà không thay đổi ownership.
- Không tự đổi role; không hạ quyền Admin active cuối cùng. Không cấp Admin cho tài khoản inactive; phải mở khóa trước.
- Quy tắc còn ít nhất một Admin active được kiểm tra trong transaction và phải đúng khi hai Admin thay đổi đồng thời.
- Với cả khóa/mở khóa và đổi role: request mang revision đã đọc. Dữ liệu đã thay đổi từ revision đó trả `409`; UI tải lại thông tin trước khi thao tác tiếp.
- Sau khi kiểm tra revision, request đặt cùng giá trị hiện tại là no-op, không tạo nhật ký thay đổi giả và không vô hiệu hóa phiên thêm lần nữa. Retry dùng revision cũ trả `409`, không lặp lại thay đổi đã commit.

### FR-AD-06: Phiên và hiệu lực quyền

- Khóa hoặc đổi role làm vô hiệu hóa access/refresh token đã phát hành cho tài khoản đích. Mở khóa không làm token cũ sống lại; người dùng phải đăng nhập lại.
- Backend có cơ chế phân biệt phiên cũ với phiên phát hành sau thay đổi; chỉ xóa refresh token là chưa đủ.
- Stream riêng tư đang mở của tài khoản bị khóa/đổi role phải được đóng trong tối đa 30 giây; không tiếp tục gửi dữ liệu theo quyền cũ.
- User mutation và sự kiện audit được commit cùng transaction. Sau commit, việc thu hồi token phải có khả năng retry; trạng thái server vẫn chặn token cũ ngay cả khi Redis tạm lỗi.

## 6. FR-AD-07: Dashboard

Dashboard hiển thị thời điểm cập nhật, bộ chọn thời gian và các nhóm số liệu sau:

| Chỉ số | Định nghĩa |
| --- | --- |
| Tài khoản | Tổng tài khoản, Client active/inactive, Admin active tại thời điểm truy vấn |
| Workflow | Tổng workflow và số theo `DRAFT`, `PUBLISHED`, `ARCHIVED`; số workflow đang active là thống kê riêng |
| Execution | Số lượt theo `QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, `CANCELLED` trong khoảng chọn |
| Tỷ lệ thành công | `SUCCESS / (SUCCESS + FAILED) × 100`; không tính lượt chưa kết thúc hoặc bị hủy |
| Xu hướng | Số execution theo ngày và trạng thái |
| Nhóm lỗi | Nhóm theo mã lỗi do hệ thống chuẩn hóa; không group theo raw error message |

- Nhóm lỗi chỉ đếm execution `FAILED`; các lý do `CANCELLED` được thống kê riêng theo trạng thái hủy.
- Mặc định 7 ngày gần nhất; chọn nhanh 24 giờ, 7 ngày, 30 ngày hoặc khoảng tùy chọn tối đa 90 ngày.
- Khoảng lọc execution dùng `queuedAt`, dạng `[from, to)` với thời điểm ISO 8601 UTC. UI hiển thị theo múi giờ trình duyệt; biểu đồ nhóm ngày theo múi giờ gửi kèm truy vấn.
- Số liệu tài khoản/workflow là snapshot hiện tại, không bị hiểu là số được tạo trong khoảng lọc execution. UI ghi rõ hai cách đếm này.
- Khi mẫu số bằng 0, tỷ lệ thành công hiển thị “Chưa có dữ liệu”, không hiển thị 0%.
- Có loading, empty, error và nút tải lại. Tự cập nhật mỗi 30 giây khi trang đang hiển thị; không gọi polling khi tab bị ẩn.
- Dashboard dùng aggregate phía server, không tải toàn bộ user/execution về frontend để đếm.

## 7. Quản lý connector

### FR-AD-08: Catalog và mức sử dụng

- Admin xem ID/key, tên, auth type, trạng thái catalog, trạng thái cho phép tạo credential mới và số credential/workflow đang tham chiếu connector.
- Lọc trạng thái và tìm theo tên/key. Connector không khả dụng trong catalog vẫn được hiển thị cho Admin để tra cứu; không cho bật tạo kết nối mới với connector đó.
- Không hiển thị danh sách secret hoặc thông tin nhạy cảm của credential. Số workflow là số workflow distinct có tham chiếu connector trong current published version; credential count là số credential còn lưu. Không suy diễn hai số đếm này thành số kết nối đã kiểm tra thành công.

### FR-AD-09: Cho phép/chặn credential mới

- Chính sách độc lập `allowNewCredentials`, mặc định `true` cho connector khả dụng. Giá trị hiệu lực còn phụ thuộc catalog/runtime có hỗ trợ connector.
- Admin có thể thay đổi chính sách với lý do và revision hiện tại. UI nêu rõ thao tác chỉ ảnh hưởng việc tạo credential mới.
- Backend kiểm tra ở mọi đường tạo credential: API-key/form, OAuth start và OAuth callback. Nếu chính sách bị chặn trong lúc OAuth diễn ra, callback không lưu credential mới.
- Credential đã có vẫn được liệt kê, chọn trong workflow, sử dụng và gia hạn token như trước. Không xóa credential hoặc thay snapshot version.
- Chặn tạo credential mới không chặn publish/run dùng credential hiện có. Không thay `isActive`, auth type, config schema hay executor implementation.
- Chính sách tồn tại qua restart, seed và package catalog sync. Thao tác Admin không bị đồng bộ catalog ghi đè.
- Khi bị chặn, Client nhận trạng thái rõ ràng và API tạo credential trả `409`, mã `CONNECTOR_NEW_CREDENTIALS_DISABLED`.
- Tạo credential và thay policy đồng thời phải có thứ tự commit nhất quán: credential đã commit trước khi policy thay đổi được giữ; các lần tạo commit sau khi chặn phải bị từ chối.

## 8. FR-AD-10: Theo dõi execution

- Lọc theo owner ID, workflow ID, execution ID, trạng thái, trigger type và khoảng thời gian. Owner là chủ workflow, không phải chỉ người bấm Run.
- Danh sách hiển thị execution ID, workflow ID/tên, owner ID/tên/email, version ID/số, trigger type, trạng thái, thời điểm enqueue/bắt đầu/kết thúc và duration.
- Chi tiết chỉ thêm metadata node: node instance ID, node type key, status, timing, retry count và mã lỗi an toàn. Không trả tên node tùy chỉnh hoặc raw error message vì có thể chứa dữ liệu Client.
- Không trả definition, input/output, context, prompt, raw webhook payload, stack trace, token, secret hoặc ciphertext. Mã lỗi chưa phân loại dùng `UNCLASSIFIED_ERROR`; không lấy raw message làm fallback.
- `durationMs`, `startedAt`, `finishedAt` chưa có thì trả `null`, UI hiển thị “—”. Không giả lập 0 hoặc trạng thái hoàn tất.
- Metadata của một execution đã tồn tại vẫn được đọc nếu account owner bị khóa. Không có nút Run, Retry, Cancel hoặc mở canvas Client trong khu vực Admin.
- Danh sách mới nhất trước theo `queuedAt` và ID; phân trang phía server. Trang đang hiển thị cập nhật mỗi 30 giây, có nút tải lại.

## 9. FR-AD-11: Nhật ký quản trị

- Mọi thay đổi có hiệu lực ở account active/role và connector policy phải tạo sự kiện audit cùng transaction với thay đổi.
- Sự kiện gồm ID, actor type/ID, action, loại/ID tài nguyên, thời điểm, lý do và trước/sau theo whitelist field. Thao tác qua Admin API có actor type `ADMIN` và actor ID lấy từ phiên; bootstrap qua lệnh nội bộ có actor type `SYSTEM`, actor ID `null`. Chỉ ghi role, active hoặc policy; không snapshot cả object user/credential.
- Các action tối thiểu: `USER_SUSPENDED`, `USER_REACTIVATED`, `USER_ROLE_CHANGED`, `CONNECTOR_POLICY_CHANGED`, `ADMIN_BOOTSTRAPPED`.
- Lý do bắt buộc, trim, từ 5 đến 500 ký tự. UI nhắc không nhập secret hoặc nội dung dữ liệu Client vào lý do.
- Audit failure làm mutation rollback; không hiển thị thành công nếu thiếu sự kiện. Các no-op hoặc request bị từ chối không được ghi thành thay đổi thành công.
- Admin chỉ đọc, lọc actor, action, target và thời gian. Không có API chỉnh sửa/xóa audit; P0 phải ghi, P1 bổ sung màn hình tra cứu.

## 10. Luồng giao diện

| Route | Màn hình | Nội dung chính |
| --- | --- | --- |
| `/admin` | Dashboard | Chỉ số, khoảng thời gian, xu hướng, nhóm lỗi |
| `/admin/users` | Tài khoản | Bộ lọc, phân trang, role và trạng thái |
| `/admin/users/:id` | Chi tiết tài khoản | Metadata, số liệu, workflow summary, thao tác role/active |
| `/admin/connectors` | Connector | Catalog, mức sử dụng, chính sách tạo credential mới |
| `/admin/executions` | Execution | Bộ lọc và danh sách |
| `/admin/executions/:id` | Execution detail | Metadata và trạng thái node |
| `/admin/audit-events` | Nhật ký quản trị | Lịch sử thay đổi và bộ lọc |

Luồng thay đổi tài khoản: mở chi tiết → chọn thao tác → nhập lý do → xem trạng thái trước/sau cùng tác động → xác nhận → backend kiểm tra revision/quyền → commit và tải lại dữ liệu. UI không cập nhật thành công trước khi server xác nhận; khi xung đột phải giữ nguyên dữ liệu đang hiển thị rồi tải lại trạng thái mới.

Giao diện dùng shadcn/ui và Tailwind CSS v4. Dialog, form control, button, table, pagination và menu tuân theo chuẩn frontend; không tạo primitive tương đương từ HTML riêng.

## 11. Hợp đồng API đề xuất

Các path theo convention hiện tại `/api/*`; không giả định hệ thống đã triển khai `/api/v1`.

| Method/path | Hành vi |
| --- | --- |
| `GET /api/admin/dashboard` | Aggregate với `from`, `to`, `timezone` |
| `GET /api/admin/users` | `q`, `role`, `isActive`, pagination |
| `GET /api/admin/users/:id` | Chi tiết và revision hiện tại |
| `GET /api/admin/users/:id/workflows` | Workflow metadata có phân trang |
| `PATCH /api/admin/users/:id/active` | `{ isActive, reason, expectedRevision }` |
| `PATCH /api/admin/users/:id/role` | `{ role, reason, expectedRevision }` |
| `GET /api/admin/connectors` | Catalog metadata, policy/revision và mức sử dụng |
| `PATCH /api/admin/connectors/:id/credential-policy` | `{ allowNewCredentials, reason, expectedRevision }` |
| `GET /api/admin/executions` | Bộ lọc mục 8 và pagination |
| `GET /api/admin/executions/:id` | Metadata whitelist của execution/node |
| `GET /api/admin/audit-events` | Bộ lọc mục 9 và pagination |

- List mặc định `page=1`, `pageSize=20`, tối đa 100; giá trị không hợp lệ trả `400`.
- `q` trim, tối đa 100 ký tự. ID sai định dạng, enum lạ, múi giờ lạ hoặc khoảng thời gian sai trả `400`. Execution/audit cũng giới hạn mỗi truy vấn tối đa 90 ngày, cho phép chọn các khoảng lịch sử trước đó.
- Response thành công theo convention `{ success: true, data }`; list `data` có `items`, `page`, `pageSize`, `total`. Mutation trả metadata đã cập nhật, revision mới và audit event ID; no-op trả audit event ID `null`.
- Mutation không nhận field ngoài whitelist; `actorId` lấy từ phiên đã xác thực.
- Lỗi có mã ổn định cho UI: `SELF_ADMIN_CHANGE_FORBIDDEN`, `LAST_ACTIVE_ADMIN`, `TARGET_USER_INACTIVE`, `STALE_REVISION`, `CONNECTOR_UNAVAILABLE`, `CONNECTOR_NEW_CREDENTIALS_DISABLED`.
- Guard xử lý `401/403` trước tra cứu tài nguyên. Với Admin hợp lệ, tài nguyên không tồn tại trả `404`; ràng buộc nghiệp vụ hoặc revision lỗi trả `409`. Lỗi không có dữ liệu nội bộ hoặc secret.

## 12. Yêu cầu triển khai và dữ liệu

- Tách module quản trị theo Modular Monolith/Clean Architecture/CQRS. Auth giữ nghiệp vụ tài khoản; Connector giữ policy; Execution/Triggers giữ quyền khởi chạy; query Admin dùng các port/projection đọc. Không truy cập repository nội bộ của module khác trực tiếp từ controller.
- Cần dữ liệu cho hai role, revision/account session validity, policy connector độc lập, audit events và mã lỗi an toàn. Thiết kế schema chi tiết thuộc bước design; không dùng field `isActive` của connector để thay policy mới.
- Migration role phải bảo toàn quan hệ và chạy trong pipeline deploy thông thường. Bootstrap Admin đầu tiên được hoàn thành trước khi bật chức năng Admin.
- Projection dùng pagination/aggregate và index phù hợp. Không trả log payload để thống kê; mã lỗi phải được phân loại mà không lưu raw message vào projection Admin.
- Timestamps lưu/trao đổi UTC. Không có chức năng tự xóa lịch sử trong MVP; bổ sung retention phải có yêu cầu riêng.

## 13. Tiêu chí nghiệm thu

| Mã | Tình huống | Kết quả bắt buộc |
| --- | --- | --- |
| AC-01 | Client gọi trực tiếp bất kỳ Admin API | `403`, không đọc hoặc thay đổi dữ liệu |
| AC-02 | Public register truyền `role: ADMIN` hoặc role cũ | `400`, không tạo tài khoản quyền cao |
| AC-03 | Chuyển dữ liệu role cũ | Hai role cũ thành Client; Admin và các quan hệ/dữ liệu giữ nguyên |
| AC-04 | Khóa Client đang đăng nhập rồi mở khóa | Token cũ không dùng lại được; dữ liệu còn nguyên; đăng nhập mới hoạt động sau mở khóa |
| AC-05 | Khóa owner có webhook và lượt queued/running | Không enqueue lượt mới; queued bị hủy trước executor; running hoàn tất; không replay khi mở khóa |
| AC-06 | Admin tự khóa/đổi role hoặc hai Admin cùng hạ quyền nhau | Tự thay đổi bị chặn; luôn còn ít nhất một Admin active |
| AC-07 | Hai Admin cùng sửa một account/policy từ revision cũ | Chỉ thay đổi hợp lệ đầu tiên commit; request còn lại `409` |
| AC-08 | Hạ quyền Admin nhưng JWT cũ vẫn ghi ADMIN | Phiên cũ hết hiệu lực; đăng nhập mới chỉ có quyền Client |
| AC-09 | Audit write thất bại hoặc retry request đã hoàn thành | Mutation thất bại rollback; retry revision cũ trả `409`; no-op với revision mới nhất không tạo audit giả |
| AC-10 | Chặn connector trong lúc OAuth đang diễn ra | Không lưu credential mới sau policy commit; credential cũ vẫn chạy/gia hạn được |
| AC-11 | Restart, seed, package sync sau thay connector policy | Chính sách Admin được giữ nguyên |
| AC-12 | Execution lỗi có email, prompt/token trong payload/message | Admin response không chứa các giá trị đó; chỉ có metadata/mã lỗi whitelist |
| AC-13 | Admin dùng endpoint Client để đọc version/credential người khác | Bị ownership check từ chối; không được bypass bằng role |
| AC-14 | Tập mẫu 3 SUCCESS, 1 FAILED, 2 CANCELLED, 1 RUNNING | Tỷ lệ thành công 75%; các số trạng thái khớp; mẫu số 0 hiển thị không có dữ liệu |
| AC-15 | Execution tự động có `triggeredById=null` | Vẫn lọc/đếm được theo owner workflow |
| AC-16 | Lọc `[from,to)` và ngày qua ranh giới timezone | Không đếm lượt ở `to`; lượt nhóm đúng ngày theo timezone đã chọn |
| AC-17 | Không có dữ liệu, request lỗi hoặc tab bị ẩn | Empty/error rõ ràng, tải lại được; không polling khi tab bị ẩn |

Khi triển khai, kiểm thử backend qua HTTP với PostgreSQL/Redis test cho authorization, concurrency, session, audit và các đường credential/trigger. Kiểm thử frontend qua hành vi màn hình/form bằng Vitest; không kiểm thử chỉ bằng cách snapshot cấu trúc JSX. Specs/test theo các thư mục `test/` của backend và chuẩn frontend hiện hành.
