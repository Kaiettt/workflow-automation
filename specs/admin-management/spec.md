# Spec: Quản trị nền tảng FlowPilot

Status: ready-for-agent

Tiến độ: P0 (G0–G3: Role, User Management, Dashboard) đã triển khai và nghiệm thu thực tế theo PR #39. G5 (Node Type Management) đã triển khai; xem [bằng chứng kiểm tra và giới hạn](5.node-type-management/task.md). Các đặc tả P1 còn lại (G4, G6, G7) được theo dõi trong checklist riêng. Xem chi tiết: [analysis](analysis.md), [design](design.md), [plan](plan.md), [task](task.md), [validation](validation.md), [operations](operations.md).

## 1. Mục tiêu và nguồn yêu cầu

Xây dựng khu vực Quản trị (Admin) toàn diện cho nền tảng FlowPilot để quản lý tài khoản người dùng, giám sát các chỉ số vận hành, kiểm soát chính sách kết nối dịch vụ ngoài (Connectors), điều phối danh mục khối chức năng (Node Types), theo dõi các lượt thực thi (Executions) và tra cứu lịch sử kiểm toán (Audit Logs). Hệ thống vận hành với mô hình phân quyền chặt chẽ gồm hai role: `CLIENT` và `ADMIN`.

Nguồn yêu cầu:
- [Phân tích chức năng và rủi ro](analysis.md)
- [Kiến trúc và thiết kế](design.md)
- [Kế hoạch triển khai](plan.md) và [Checklist công việc](task.md)
- [PRD](../../docs/prd.md): Đối tượng sử dụng, ranh giới quyền riêng tư và phạm vi quản trị nền tảng.
- [SRS](../../docs/srs.md): FR-AU-01, FR-AU-07, FR-AU-09, FR-CF-07, nhóm FR-AD, FR-NL-*, FR-EX-*, FR-EM-*.
- [Thuật ngữ miền](../../CONTEXT.md).

## 2. Phạm vi và phân kỳ triển khai

| Nhóm tính năng | Giai đoạn | Trạng thái | Kết quả bàn giao chính |
| --- | --- | --- | --- |
| Hai role và cổng truy cập Admin | G1 (P0) | Đã hoàn thành | Đăng ký công khai chỉ cấp `CLIENT`, phân quyền server-side, bảo vệ route `/admin/*` |
| Quản lý tài khoản | G2 (P0) | Đã hoàn thành | Danh sách, chi tiết, khóa/mở khóa tài khoản, chuyển đổi role, quy tắc last active admin |
| Vô hiệu hóa phiên & Audit tài khoản | G2 (P0) | Đã hoàn thành | Thu hồi JWT tức thì qua `session_version`, transaction lock, ghi audit event `USER_*` |
| Dashboard vận hành | G3 (P0) | Đã hoàn thành | Snapshot tài khoản/workflow, aggregate execution 90 ngày, tỷ lệ thành công, xu hướng ngày, nhóm lỗi an toàn |
| Quản lý Connector | G4 (P1) | Đặc tả sẵn sàng | Catalog connector, thống kê sử dụng, chính sách `allowNewCredentials`, hỗ trợ API Key/OAuth2, chống race condition |
| Quản lý Node Type | G5 (P1) | Đặc tả sẵn sàng | Catalog node type, thống kê sử dụng workflow, tách bạch `isCatalogVisible` và `isExecutionAllowed`, bảo toàn workflow cũ |
| Giám sát Execution | G6 (P1) | Đặc tả sẵn sàng | Tra cứu danh sách & chi tiết execution toàn nền tảng, bộ lọc đa chiều, projection an toàn tuyệt đối (không lộ secret/payload) |
| Tra cứu Nhật ký quản trị | G7 (P1) | Đặc tả sẵn sàng | Giao diện danh sách và chi tiết audit event, bộ lọc actor/action/resource/thời gian, hiển thị diff before/after whitelist |
| Nghiệm thu tổng thể & Rollout | G8 (P1) | Đặc tả sẵn sàng | Kiểm thử tự động end-to-end, rehearsal migration, quy trình vận hành và tài liệu bàn giao |

Ngoài phạm vi: Xóa tài khoản hoặc xóa dữ liệu Client; giả lập đăng nhập Client (impersonation); đọc/chỉnh sửa nội dung canvas, snapshot version, JSON input/output, biến môi trường, webhook payload thô, AI prompt hoặc credential/secret của Client; thực hiện Run, Retry hoặc Cancel execution từ khu vực Admin; thêm connector bằng mã nguồn trực tiếp từ giao diện web; thay đổi auth type hoặc JSON config schema của connector trên UI; quản lý secret hạ tầng (database, Redis, JWT keys); hệ thống thanh toán/billing; mô hình đa tổ chức (multi-tenancy/teams); giám sát CPU/RAM máy chủ.

## 3. Ma trận quyền hạn (Access Control Matrix)

| Tài nguyên / Thao tác | Vai trò Client | Vai trò Admin |
| --- | --- | --- |
| Workflow, version, credential và execution của chính mình | Toàn quyền theo ownership | Toàn quyền theo cùng quy tắc ownership cá nhân |
| Danh sách và chi tiết tài khoản toàn nền tảng | Không có quyền (403) | Đọc metadata tài khoản (không lộ password hash, token, OTP) |
| Khóa/mở khóa hoặc đổi role tài khoản khác | Không có quyền (403) | Có quyền theo quy tắc bất biến (không tự sửa, không hạ Admin cuối) |
| Dashboard và số liệu vận hành toàn nền tảng | Không có quyền (403) | Đọc số liệu tổng hợp (aggregate) và xu hướng |
| Quản lý chính sách Connector (`allowNewCredentials`) | Chỉ xem trạng thái công khai | Xem danh mục, thống kê sử dụng và thay đổi chính sách tạo mới |
| Quản lý trạng thái Node Type (`catalog/execution`) | Chỉ xem node đang active trong palette | Xem danh mục, thống kê sử dụng và bật/tắt hiển thị / thực thi |
| Giám sát execution toàn nền tảng | Không có quyền (403) | Xem danh sách & chi tiết metadata an toàn (không có payload/secrets/logs thô) |
| Can thiệp execution người khác (Run/Retry/Cancel) | Theo ownership workflow | Tuyệt đối không có quyền trong khu vực Admin |
| Nội dung canvas/input/output/secret của người khác | Không có quyền (403) | Tuyệt đối không có quyền trong Admin MVP |
| Tra cứu nhật ký quản trị (Audit Logs) | Không có quyền (403) | Chỉ đọc danh sách và chi tiết sự kiện kiểm toán |

## 4. FR-AD-01: Truy cập Admin và Chuyển đổi Role (P0 - Đã hoàn thành)

- Mọi route `/admin/*` và API `/api/admin/*` được bảo vệ nghiêm ngặt: yêu cầu người dùng đã đăng nhập, tài khoản đang active và có role hiện tại trong database là `ADMIN`.
- Không có phiên hợp lệ trả về `401 Unauthorized`. Client đăng nhập hợp lệ nhưng không phải Admin gọi API trả về `403 Forbidden`. Menu và nút điều hướng Admin chỉ hiển thị với người dùng có quyền Admin.
- Backend luôn truy vấn trạng thái và role hiện tại từ database, không tin tưởng vào claim role tĩnh trong JWT token cũ hoặc thông tin gửi từ client.
- Đăng ký tài khoản công khai (`/api/auth/register`) không cho phép chọn role; mọi request gửi kèm field `role` đều bị từ chối với `400 Bad Request`. Mọi tài khoản mới luôn mang role `CLIENT`.
- Dữ liệu lịch sử: Các role cũ `DEVELOPER` và `BUSINESS_USER` được chuyển đổi thành `CLIENT`; role `ADMIN` được giữ nguyên. Toàn bộ quan hệ workflow, version, credential và execution được bảo toàn nguyên vẹn.
- Admin đầu tiên trên production được cấp phát thông qua công cụ CLI nội bộ có kiểm toán (`npm run admin:bootstrap`); không mở bất kỳ public API nào để tự cấp quyền Admin. Môi trường local có tài khoản seed mặc định `admin@flowpilot.local`.

## 5. Quản lý Tài khoản (P0 - Đã hoàn thành)

### FR-AD-02: Danh sách và tìm kiếm tài khoản
- Hiển thị danh sách tài khoản gồm: ID, họ tên, email, role, trạng thái `isActive`, số revision, thời điểm tạo và cập nhật.
- Hỗ trợ tìm kiếm theo tên hoặc email (không phân biệt hoa thường), lọc theo role (`CLIENT`, `ADMIN`), lọc theo trạng thái (`active`, `inactive`).
- Phân trang phía server (mặc định 20 bản ghi/trang, tối đa 100), sắp xếp giảm dần theo thời điểm tạo (`createdAt desc`, `id desc`).
- Tuyệt đối không trả về password hash, session token, refresh token hay OTP.

### FR-AD-03: Chi tiết tài khoản và tóm tắt tài nguyên
- Hiển thị thông tin chi tiết tài khoản cùng số liệu thống kê: tổng số workflow sở hữu, tổng số credential đã tạo, tổng số execution đã phát sinh từ các workflow thuộc quyền sở hữu (bao gồm cả các execution tự động chạy không có `triggeredById`).
- Danh sách tóm tắt workflow của tài khoản: ID, tên workflow, trạng thái (`DRAFT`, `PUBLISHED`, `ARCHIVED`), cờ kích hoạt (`active`), thời điểm cập nhật. Không trả về definition JSON, config hay snapshot version.

### FR-AD-04: Khóa và mở khóa tài khoản
- Admin có thể khóa hoặc mở khóa tài khoản khác; thao tác bắt buộc phải nhập lý do (5–500 ký tự), xác nhận và truyền kèm `expectedRevision` hiện tại.
- Quy tắc bất biến: Admin không thể tự khóa chính mình; không thể khóa tài khoản Admin active cuối cùng trong hệ thống; không xóa dữ liệu người dùng.
- Hiệu lực tức thì: Khóa tài khoản lập tức tăng `session_version`, vô hiệu hóa access/refresh token cũ trên cả database và Redis outbox.
- Tác động tới workflow:
  - Ngăn chặn toàn bộ manual run, schedule trigger, và webhook trigger mới. Webhook gửi đến workflow của owner bị khóa vẫn được trả mã HTTP ACK (200/202) theo contract của nhà cung cấp dịch vụ nhưng bị loại bỏ ngay tại gateway, không đưa vào hàng đợi `QUEUED` và không ghi payload vào test event store.
  - Khi worker claim một execution đang ở trạng thái `QUEUED`: kiểm tra trạng thái owner row trong cùng transaction; nếu owner đã bị khóa, execution lập tức được chuyển thành `CANCELLED` với mã lý do `OWNER_SUSPENDED`, không gọi bất kỳ executor hay dịch vụ bên ngoài nào.
  - Các execution đã chuyển sang `RUNNING` trước thời điểm khóa được phép chạy đến khi hoàn tất.
  - Giữ nguyên trạng thái `active` của workflow và version đã publish. Mở khóa tài khoản cho phép nhận sự kiện mới bình thường; không tự động chạy lại (replay) các sự kiện đã bị bỏ qua hoặc các lượt đã bị hủy.

### FR-AD-05: Chuyển đổi Role tài khoản
- Admin có thể nâng quyền Client lên Admin hoặc hạ quyền Admin xuống Client mà không làm thay đổi quyền sở hữu workflow hay credential.
- Không thể tự đổi role của chính mình; không thể hạ quyền Admin active cuối cùng. Không thể cấp quyền Admin cho tài khoản đang bị khóa (`isActive = false`).
- Kiểm tra tính bất biến "còn ít nhất 1 Admin active" được thực hiện với advisory lock trong database transaction để đảm bảo tính toàn vẹn khi nhiều Admin thao tác đồng thời.
- Yêu cầu kiểm tra `expectedRevision`: Xung đột sửa đổi trả về `409 Conflict`. Request đặt cùng giá trị hiện tại được xử lý là no-op, không tăng revision, không ghi audit giả và không vô hiệu hóa phiên.

### FR-AD-06: Quản lý phiên và thu hồi quyền tức thì
- Thao tác khóa tài khoản hoặc thay đổi role làm vô hiệu hóa toàn bộ access token và refresh token đã phát hành trước đó cho tài khoản mục tiêu.
- Mở khóa tài khoản tăng `session_version` mới; các token cũ không bao giờ hoạt động trở lại; người dùng bắt buộc phải đăng nhập lại.
- Các kết nối Server-Sent Events (SSE) hoặc long-polling stream riêng tư đang mở của tài khoản bị khóa/đổi role phải bị ngắt kết nối trong vòng tối đa 30 giây (thông qua heartbeat recheck 15 giây).

## 6. FR-AD-07: Dashboard Vận hành Toàn diện (P0 - Đã hoàn thành)

Dashboard cung cấp cái nhìn tổng quan về quy mô và sức khỏe hệ thống:
- **Snapshot tài nguyên hiện tại**: Tổng số tài khoản (phân loại Client active/inactive, Admin active), tổng số workflow (phân loại `DRAFT`, `PUBLISHED`, `ARCHIVED` và số workflow đang bật `active`).
- **Thống kê Execution theo khoảng thời gian**: Đếm số lượt theo trạng thái (`QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, `CANCELLED`) theo thời điểm vào hàng đợi (`queuedAt` trong khoảng nửa mở `[from, to)`).
- **Tỷ lệ thành công (Success Rate)**: Tính theo công thức `SUCCESS / (SUCCESS + FAILED) * 100`. Các lượt `CANCELLED` hoặc chưa kết thúc không được tính vào mẫu số. Khi mẫu số bằng 0, hiển thị "Chưa có dữ liệu" thay vì 0%.
- **Biểu đồ xu hướng (Trend)**: Số lượng execution theo ngày và theo từng trạng thái, được nhóm theo múi giờ do client gửi lên.
- **Phân nhóm lỗi (Error Groups)**: Tổng hợp các execution `FAILED` theo mã lỗi an toàn đã chuẩn hóa (`errorCode`); không nhóm theo chuỗi thông điệp lỗi thô.
- Bộ chọn thời gian: 24 giờ qua, 7 ngày qua (mặc định), 30 ngày qua, hoặc khoảng tùy chọn tối đa 90 ngày.
- Cơ chế tự động cập nhật: Polling định kỳ mỗi 30 giây khi tab trình duyệt đang hiển thị (`document.visibilityState === 'visible'`); tạm dừng toàn bộ polling khi tab bị ẩn.

---

## 7. Quản lý Connector (G4 - P1 Mới)

### FR-AD-08: Danh mục và Thống kê sử dụng Connector
- **Danh mục Connector**: Admin có thể xem danh sách toàn bộ các Connector trong hệ thống với các trường metadata: ID, key định danh (ví dụ `http`, `slack`, `google-sheets`), tên hiển thị, loại xác thực (`NONE`, `API_KEY`, `OAUTH2`, `BASIC`), trạng thái hỗ trợ kỹ thuật (`Connector.isActive`), trạng thái chính sách tiếp nhận kết nối mới (`allowNewCredentials`), thời điểm tạo.
- **Thống kê sử dụng**:
  - `credentialCount`: Tổng số credential hiện đang được lưu trữ của connector này trên toàn hệ thống.
  - `workflowCount`: Số lượng workflow phân biệt (distinct workflows) đang tham chiếu đến connector này trong phiên bản đã phát hành hiện tại (`PUBLISHED`).
- **Tìm kiếm và lọc**: Tìm kiếm theo tên hoặc key; lọc theo loại xác thực (`authType`), lọc theo trạng thái catalog (`isActive`), lọc theo chính sách (`allowNewCredentials`).
- **Bảo mật**: Tuyệt đối không hiển thị danh sách chi tiết các secret, access token, refresh token hay API key của người dùng.

### FR-AD-09: Chính sách Cho phép/Chặn Tạo Credential Mới (`allowNewCredentials`)
- **Tách bạch chính sách và trạng thái hệ thống**:
  - `Connector.isActive` thể hiện connector có mã nguồn/package hoạt động trong hệ thống hay không (do code & sync quyết định).
  - `allowNewCredentials` (mặc định `true`) là cờ quản trị độc lập, cho phép Admin tạm dừng nhận thêm credential mới mà không gây ảnh hưởng đến vận hành hiện tại.
- **Bảo toàn kết nối và workflow hiện có**:
  - Khi `allowNewCredentials = false`: Toàn bộ các credential đã tạo trước đó **vẫn hoạt động bình thường**. Người dùng vẫn có thể chọn credential này trong các workflow mới hoặc cũ, workflow đang chạy vẫn sử dụng credential bình thường, và các tiến trình refresh token định kỳ vẫn hoạt động.
  - Không thay đổi `Connector.isActive`, không thay đổi config schema, không xóa hay vô hiệu hóa bất kỳ bản ghi `ConnectorCredential` nào.
- **Cơ chế kiểm soát mọi luồng tạo Credential**:
  - **API Key / Form Credential**: `POST /api/connectors/:id/credentials` phải kiểm tra chính sách; nếu `allowNewCredentials = false`, từ chối với HTTP `409 Conflict`, mã lỗi `CONNECTOR_NEW_CREDENTIALS_DISABLED`.
  - **Google OAuth**: Chặn ngay từ bước tạo URL xác thực (`GET /api/integrations/google/auth`). Đồng thời, tại bước callback hoàn tất (`GET /api/integrations/google/callback`), phải mở transaction, khóa dòng connector policy và kiểm tra lại: nếu chính sách đã bị tắt trong lúc người dùng đang thao tác trên Google, lập tức hủy lưu trữ và trả về thông báo lỗi.
  - **Package OAuth2**: Chặn tại bước khởi tạo (`GET /api/oauth2/auth`) và kiểm tra lại bắt buộc trong transaction tại bước hoàn tất lưu token (`POST /api/oauth2/complete`).
- **Chống Race Condition**: Thao tác cập nhật chính sách connector và thao tác lưu credential mới phải cạnh tranh trên cùng một transaction lock của connector. Credential nào commit trước thời điểm policy thay đổi được chấp nhận; credential nào commit sau khi cờ chuyển thành `false` phải bị rollback và báo lỗi.
- **Độ bền qua khởi động lại hệ thống (Persistence against Sync/Restart)**:
  - Chính sách quản trị được lưu trữ trong bảng riêng `connector_policies`.
  - Tiến trình khởi động server (`PackageCatalogSync` và Database Seed) chỉ thực hiện upsert danh mục kỹ thuật vào bảng `connectors`, **tuyệt đối không ghi đè** hay xóa bỏ các thiết lập trong `connector_policies`.
- **Thao tác Admin**: Thay đổi cờ `allowNewCredentials` yêu cầu truyền `expectedRevision` và lý do bắt buộc (5–500 ký tự). Ghi nhận audit event `CONNECTOR_POLICY_CHANGED` trong cùng transaction.

---

## 8. Quản lý Loại Node - Node Types (G5 - P1 Mới)

### FR-AD-10: Danh mục và Thống kê sử dụng Node Type
- **Danh mục Node Type**: Admin có thể xem toàn bộ các khối chức năng (Node Types) trong catalog: ID, key định danh (ví dụ `trigger.webhook`, `integration.slack.postMessage`, `logic.if`), tên hiển thị, biểu tượng (icon), màu sắc, danh mục (`TRIGGER`, `ACTION`, `LOGIC`, `TRANSFORMATION`, `INTEGRATION`), gói package cung cấp, loại connector liên kết (nếu có), trạng thái hiển thị catalog (`isCatalogVisible`), trạng thái cho phép thực thi (`isExecutionAllowed`), số revision.
- **Thống kê mức độ sử dụng**:
  - `publishedWorkflowCount`: Số lượng workflow phân biệt đã phát hành (`PUBLISHED`) có chứa ít nhất một node thuộc loại này trong cấu trúc graph hiện tại.
  - `draftWorkflowCount`: Số lượng workflow nháp (`DRAFT`) đang chứa node thuộc loại này.
- **Tìm kiếm và lọc**: Tìm kiếm theo key hoặc tên hiển thị; lọc theo danh mục (`category`), lọc theo connector liên kết, lọc theo trạng thái hiển thị (`isCatalogVisible`), lọc theo quyền thực thi (`isExecutionAllowed`).
- **Chi tiết Node Type**: Xem toàn bộ schema cấu hình (`configSchema`), schema dữ liệu đầu vào (`inputSchema`), schema dữ liệu đầu ra (`outputSchema`), phiên bản package và danh sách workflow tiêu biểu đang sử dụng (chỉ ID, tên workflow, owner email).

### FR-AD-11: Bật/Tắt Loại Node và Tính Tương Thích Ngược
- **Phân tách 2 cấp độ kiểm soát**:
  1. **Hiển thị trên Palette (`isCatalogVisible`)**:
     - Khi `isCatalogVisible = false`: Node type này bị ẩn khỏi danh sách `GET /api/node-types` gửi cho Designer canvas của Client. Người dùng không thể kéo thả thêm node này vào các workflow mới hoặc chỉnh sửa.
     - **Tính tương thích**: Các workflow đã phát hành hoặc đang thiết kế dở có chứa node này **vẫn tiếp tục hoạt động và thực thi bình thường**.
  2. **Cho phép thực thi ở Runtime (`isExecutionAllowed`)**:
     - Mặc định `true`. Khi Admin phát hiện node có lỗi bảo mật hoặc dịch vụ bên thứ ba bị tê liệt, Admin có thể chuyển `isExecutionAllowed = false`.
     - **Xử lý Runtime**: Khi workflow engine thực thi đến một node bị cấm chạy, `NodeRunner` sẽ chặn gọi executor, ghi nhận log của node này với trạng thái `FAILED`, mã lỗi chuẩn hóa `NODE_TYPE_DISABLED`, và thông báo an toàn "This node type has been disabled by platform administrator". Workflow dừng hoặc chuyển hướng theo quy tắc error handling mà không làm sập tiến trình engine.
- **Độ bền qua khởi động lại hệ thống**: Cấu hình trạng thái node type được lưu trữ trong bảng `node_type_policies` có khóa ngoại trỏ tới `node_type_definitions`. Tiến trình `PackageCatalogSync` khi khởi động server chỉ cập nhật schema và metadata, không được ghi đè các cờ chính sách của Admin.
- **Thao tác Admin**: Thay đổi trạng thái yêu cầu cung cấp `expectedRevision`, lý do bắt buộc (5–500 ký tự). Ghi nhận audit event `NODE_TYPE_STATUS_CHANGED` atomic trong transaction.

---

## 9. Theo dõi Execution Toàn Nền Tảng (G6 - P1 Mới)

### FR-AD-12: Danh sách và Chi tiết Execution An Toàn
- **Danh sách Execution Toàn hệ thống**:
  - Hỗ trợ lọc đa chiều: theo `ownerId` (chủ sở hữu workflow), `workflowId`, `executionId`, trạng thái (`QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, `CANCELLED`), loại trigger (`MANUAL`, `WEBHOOK`, `SCHEDULE`), và khoảng thời gian `[from, to)` theo `queuedAt` (mặc định 7 ngày, tối đa 90 ngày).
  - Phân trang phía server (mặc định 20 bản ghi/trang, tối đa 100), sắp xếp giảm dần theo thời gian vào hàng đợi (`queuedAt desc`, `id desc`).
  - **Safe Projection Danh sách**: Trả về ID, workflowId, tên workflow, ownerId, tên owner, email owner, versionId, số phiên bản (`versionNumber`), triggerType, status, queuedAt, startedAt, finishedAt, durationMs, mã lỗi an toàn (`errorCode`), lý do hủy (`cancellationReason`).
- **Chi tiết Execution và Bảng Node Execution Logs**:
  - Hiển thị metadata tổng thể của execution (như trên).
  - Bảng danh sách các node log đã thực thi: `nodeId`, `nodeKey` (ví dụ `integration.slack.postMessage`), `status` (`SUCCESS`, `FAILED`, `SKIPPED`, `RUNNING`), thời điểm bắt đầu (`startedAt`), thời điểm kết thúc (`finishedAt`), thời gian chạy (`durationMs`), số lần thử lại (`retryCount`), mã lỗi an toàn (`errorCode`).
- **Nguyên tắc Bảo mật và Quyền riêng tư Tuyệt đối (Strict Privacy Whitelist)**:
  - **CẤM HOÀN TOÀN**: Không bao giờ trả về input JSON, output JSON, context thực thi, AI prompt, nội dung tin nhắn, webhook payload thô, stack trace lỗi, token, API key hoặc custom label/name do người dùng đặt cho node (vì custom label có thể chứa thông tin nhạy cảm như "Gửi email mật cho khách hàng X").
  - Nếu execution hoặc node bị lỗi mà chưa có mã lỗi phân loại, trả về mã fallback `UNCLASSIFIED_ERROR`; tuyệt đối không lấy chuỗi `errorMessage` thô từ exception của dịch vụ để làm fallback.
- **Quy tắc hiển thị và tương tác**:
  - Các trường thời gian chưa có (`startedAt`, `finishedAt`, `durationMs`) trả về `null`, giao diện hiển thị dấu gạch ngang "—". Không hiển thị 0ms hoặc tự suy đoán trạng thái hoàn tất.
  - **Giao diện Chỉ Đọc (Read-only)**: Tuyệt đối không cung cấp các nút thực thi (Run), chạy lại (Retry), hủy bỏ (Cancel) hoặc nút mở xem canvas workflow của Client trong khu vực Admin.
  - Tự động cập nhật: Polling danh sách/chi tiết mỗi 30 giây khi tab hiển thị; dừng ngay khi tab bị ẩn.

---

## 10. Nhật ký Quản trị - Audit Log Viewer (G7 - P1 Mới)

### FR-AD-13: Tra cứu và Kiểm toán Sự kiện Quản trị
- **Phạm vi ghi nhận**: Mọi thao tác có hiệu lực làm thay đổi trạng thái hệ thống phải được ghi nhận vào `admin_audit_events` cùng transaction với thay đổi nghiệp vụ:
  1. `USER_SUSPENDED`: Khóa tài khoản người dùng.
  2. `USER_REACTIVATED`: Mở khóa tài khoản người dùng.
  3. `USER_ROLE_CHANGED`: Chuyển đổi quyền Client ↔ Admin.
  4. `ADMIN_BOOTSTRAPPED`: Khởi tạo Admin đầu tiên qua lệnh CLI nội bộ.
  5. `CONNECTOR_POLICY_CHANGED`: Thay đổi chính sách `allowNewCredentials` của connector.
  6. `NODE_TYPE_STATUS_CHANGED`: Thay đổi trạng thái `isCatalogVisible` hoặc `isExecutionAllowed` của node type.
- **Cấu trúc bản ghi Audit**:
  - `id`: Định danh duy nhất (UUID).
  - `actorType`: `ADMIN` (thao tác qua Web Admin) hoặc `SYSTEM` (thao tác qua CLI nội bộ).
  - `actorId`: ID của Admin thực hiện (hoặc `null` nếu là `SYSTEM`).
  - `action`: Tên hành động chuẩn hóa.
  - `targetType`: Loại tài nguyên bị tác động (`USER`, `CONNECTOR`, `NODE_TYPE`).
  - `targetId`: ID hoặc Key của tài nguyên mục tiêu.
  - `reason`: Lý do bắt buộc, đã được chuẩn hóa cắt khoảng trắng (trim), độ dài từ 5 đến 500 ký tự.
  - `before` / `after`: Đối tượng JSON chỉ chứa các trường trạng thái được whitelist (ví dụ `{ isActive: false }` -> `{ isActive: true }`); không lưu mật khẩu, token, secret.
  - `createdAt`: Thời điểm phát sinh sự kiện (UTC).
- **Giao diện Tra cứu (Audit Log Viewer)**:
  - Danh sách sự kiện kiểm toán với phân trang server-side, sắp xếp mới nhất trước (`createdAt desc`, `id desc`).
  - Bộ lọc đa tiêu chí: Lọc theo `actorId`, `actorType`, `action`, `targetType`, `targetId`, và khoảng thời gian `[from, to)` (tối đa 90 ngày).
  - Chi tiết sự kiện: Hiển thị thông tin người thực hiện (tên, email nếu có), hành động, thời điểm, lý do, và bảng đối chiếu trực quan các trường thay đổi (Diff Before vs After).
- **Tính Bất biến và Toàn vẹn**:
  - Bảng audit hoàn toàn chỉ đọc; backend không cung cấp bất kỳ API nào để cập nhật (`PUT`/`PATCH`) hay xóa (`DELETE`) bản ghi audit.
  - Nếu việc ghi audit thất bại, toàn bộ transaction của mutation đó phải bị rollback; hệ thống không bao giờ ghi nhận thay đổi thành công mà thiếu bản ghi audit tương ứng.
  - Các request bị từ chối do phân quyền, sai revision (`409`), hoặc các thao tác no-op không làm phát sinh bản ghi audit.

---

## 11. Luồng Giao diện và Cấu trúc Điều hướng (UI Architecture)

Hệ thống khu vực Admin được tổ chức thành thanh điều hướng thống nhất tại `/admin`:

| Đường dẫn (Route) | Tên màn hình | Nội dung và Chức năng chính |
| --- | --- | --- |
| `/admin` | Tổng quan (Dashboard) | Các chỉ số snapshot, bộ lọc thời gian, tỷ lệ thành công, biểu đồ xu hướng, nhóm lỗi an toàn |
| `/admin/users` | Quản lý Tài khoản | Danh sách tài khoản, tìm kiếm tên/email, lọc role/trạng thái, phân trang, nút dẫn tới chi tiết |
| `/admin/users/:id` | Chi tiết Tài khoản | Metadata tài khoản, thống kê tài nguyên, danh sách workflow tóm tắt, dialog khóa/mở khóa/đổi role |
| `/admin/connectors` | Quản lý Connector | Catalog connector, loại xác thực, số credential, số workflow liên kết, dialog đổi chính sách tạo mới |
| `/admin/node-types` | Quản lý Loại Node | Catalog node, danh mục, số workflow sử dụng, switch bật/tắt hiển thị palette và quyền thực thi |
| `/admin/executions` | Giám sát Execution | Bộ lọc đa chiều (owner, workflow, execution ID, status, trigger, time), bảng danh sách metadata an toàn |
| `/admin/executions/:id` | Chi tiết Execution | Metadata execution, bảng tiến trình và kết quả từng node (status, timing, mã lỗi an toàn; không payload) |
| `/admin/audit-events` | Nhật ký Quản trị | Danh sách sự kiện kiểm toán, bộ lọc actor/action/target/thời gian, dialog xem chi tiết diff Before/After |

Chuẩn mực UI:
- Sử dụng thư viện **shadcn/ui** (`@/components/ui/*`) và **Tailwind CSS v4**. Tuyệt đối không tự viết lại các HTML element cơ bản (dialogs, buttons, tables, badges, dropdowns, inputs).
- Mọi dialog mutation đều phải yêu cầu nhập lý do, hiển thị tóm tắt tác động trước/sau và xác nhận rõ ràng trước khi gửi request.
- Mọi trang danh sách đều hỗ trợ trạng thái loading skeleton, empty state, error state có nút retry và visible-only polling.

---

## 12. Hợp đồng API Quản trị Đầy đủ

Tất cả các API quản trị nằm dưới tiền tố chuẩn `/api/admin/*`, yêu cầu `JwtAuthGuard`, `RolesGuard`, và role `ADMIN`:

| Method | Endpoint Path | Chức năng chính | Giai đoạn |
| --- | --- | --- | --- |
| `GET` | `/api/admin/dashboard` | Thống kê tổng hợp (tài khoản, workflow, execution, trend, errors) | P0 (Có sẵn) |
| `GET` | `/api/admin/users` | Danh sách tài khoản với bộ lọc `q`, `role`, `isActive`, pagination | P0 (Có sẵn) |
| `GET` | `/api/admin/users/:id` | Chi tiết tài khoản, revision và thống kê tài nguyên liên quan | P0 (Có sẵn) |
| `GET` | `/api/admin/users/:id/workflows` | Danh sách workflow tóm tắt của tài khoản có phân trang | P0 (Có sẵn) |
| `PATCH` | `/api/admin/users/:id/active` | Khóa / mở khóa tài khoản `{ isActive, reason, expectedRevision }` | P0 (Có sẵn) |
| `PATCH` | `/api/admin/users/:id/role` | Đổi role Client ↔ Admin `{ role, reason, expectedRevision }` | P0 (Có sẵn) |
| `GET` | `/api/admin/connectors` | Danh mục connector, thống kê số credential, số workflow và chính sách | G4 (P1 Mới) |
| `GET` | `/api/admin/connectors/:id` | Chi tiết connector, danh sách node type trực thuộc và thống kê chi tiết | G4 (P1 Mới) |
| `PATCH` | `/api/admin/connectors/:id/credential-policy` | Đổi chính sách `{ allowNewCredentials, reason, expectedRevision }` | G4 (P1 Mới) |
| `GET` | `/api/admin/node-types` | Danh mục loại node, lọc category, trạng thái, thống kê workflow sử dụng | G5 (P1 Mới) |
| `GET` | `/api/admin/node-types/:key` | Chi tiết loại node, config/input/output schemas và thống kê | G5 (P1 Mới) |
| `PATCH` | `/api/admin/node-types/:key/status` | Đổi trạng thái `{ isCatalogVisible?, isExecutionAllowed?, reason, expectedRevision }` | G5 (P1 Mới) |
| `GET` | `/api/admin/executions` | Danh sách execution toàn nền tảng, bộ lọc đa chiều, pagination | G6 (P1 Mới) |
| `GET` | `/api/admin/executions/:id` | Chi tiết execution và danh sách node logs an toàn (không payload) | G6 (P1 Mới) |
| `GET` | `/api/admin/audit-events` | Danh sách sự kiện audit, lọc actor, action, target, time, pagination | G7 (P1 Mới) |
| `GET` | `/api/admin/audit-events/:id` | Chi tiết sự kiện audit gồm diff before/after theo whitelist | G7 (P1 Mới) |

Quy ước chuẩn phản hồi:
- Thành công: `{ success: true, data: ... }`. Các danh sách trả về `{ items, total, page, pageSize }`.
- Phân trang: Mặc định `page = 1`, `pageSize = 20`, tối đa `pageSize = 100`.
- Mutation phản hồi: Trả về bản ghi đã cập nhật, `revision` mới và `auditEventId`.
- Mã lỗi chuẩn hóa: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict` (kèm mã lỗi ổn định như `STALE_REVISION`, `LAST_ACTIVE_ADMIN`, `CONNECTOR_NEW_CREDENTIALS_DISABLED`, `NODE_TYPE_DISABLED`).

---

## 13. Yêu cầu Kiến trúc và Cơ sở Dữ liệu

- **Tuân thủ Clean Architecture & CQRS**: Module Admin nằm tại `libs/admin`. Tách bạch Command (thay đổi dữ liệu thông qua port nghiệp vụ của domain Auth/Connector/NodeLibrary) và Query (đọc projection tối ưu qua `AdminReadPort`). Controller không trực tiếp gọi Prisma.
- **Mô hình Dữ liệu Bền vững**:
  - Tạo bảng `connector_policies` (connector_id PK FK, allow_new_credentials, revision, updated_at).
  - Tạo bảng `node_type_policies` (node_type_key PK FK, is_catalog_visible, is_execution_allowed, revision, updated_at).
  - Sử dụng các bảng này độc lập với bảng catalog để `PackageCatalogSync` không ghi đè chính sách khi server khởi động lại.
- **Bảo mật Projection Query**: Không dùng chung DTO của Client. Truy vấn SQL/Prisma chỉ `select` các cột an toàn, không bao giờ truy vấn cột `input`, `output`, `encrypted_secret`, `error_stack`, `error_message`.
- **Đánh chỉ mục (Indexing)**:
  - `executions(queued_at, status)` và `executions(workflow_id, queued_at)`.
  - `admin_audit_events(created_at, id)` và `admin_audit_events(target_id, created_at)`.
  - `connector_credentials(connector_id, created_at)`.

---

## 14. Tiêu chí Nghiệm thu Tổng thể (Acceptance Criteria)

| Mã AC | Nhóm | Tình huống kiểm thử | Kết quả bắt buộc |
| --- | --- | --- | --- |
| AC-01 | Auth | Client hoặc unauthenticated user gọi bất kỳ API Admin nào | `401 Unauthorized` hoặc `403 Forbidden`, không lộ dữ liệu |
| AC-02 | Auth | Đăng ký công khai cố truyền `role: ADMIN` hoặc role cũ | `400 Bad Request`, tài khoản tạo luôn là `CLIENT` |
| AC-03 | Auth | Dữ liệu cũ chuyển đổi sang mô hình 2 role mới | `DEVELOPER`/`BUSINESS_USER` thành `CLIENT`; `ADMIN` giữ nguyên |
| AC-04 | User | Khóa Client đang đăng nhập rồi mở khóa | Token cũ bị vô hiệu hóa; đăng nhập lại thành công sau mở khóa |
| AC-05 | User | Khóa owner có webhook và lượt queued/running | Chặn enqueue webhook mới; queued bị hủy `OWNER_SUSPENDED`; running hoàn tất |
| AC-06 | User | Admin tự khóa/đổi role chính mình hoặc 2 Admin hạ quyền nhau | Bị chặn; luôn bảo đảm còn ít nhất 1 Admin active trong database |
| AC-07 | Concurrency | 2 Admin cùng sửa một tài khoản / chính sách từ revision cũ | Request đầu tiên thành công; request thứ hai nhận `409 Stale Revision` |
| AC-08 | Auth | Hạ quyền Admin nhưng JWT cũ vẫn ghi `ADMIN` | Phiên cũ hết hiệu lực ngay lập tức; đăng nhập mới chỉ có quyền Client |
| AC-09 | Audit | Ghi audit thất bại hoặc retry request đã commit | Ghi audit lỗi làm rollback toàn bộ mutation; retry cũ trả `409` |
| AC-10 | Connector | Chặn connector trong lúc người dùng đang ở màn hình OAuth | Callback hoàn tất bị từ chối `409 CONNECTOR_NEW_CREDENTIALS_DISABLED`; credential cũ vẫn chạy |
| AC-11 | Connector | Server khởi động lại, chạy database seed và `PackageCatalogSync` | Chính sách `allowNewCredentials` do Admin đặt vẫn được giữ nguyên vẹn |
| AC-12 | Security | Execution bị lỗi do crash chứa token/prompt/secret trong raw log | Admin API chỉ trả về `errorCode` an toàn hoặc `UNCLASSIFIED_ERROR`; không có raw data |
| AC-13 | Ownership | Admin gọi endpoint Client để đọc version/credential của người khác | Bị kiểm tra ownership từ chối; role Admin không cho phép vượt quyền Client |
| AC-14 | Dashboard | Tập mẫu 3 SUCCESS, 1 FAILED, 2 CANCELLED, 1 RUNNING | Tỷ lệ thành công là 75%; các trạng thái đếm chính xác; mẫu số 0 báo không có dữ liệu |
| AC-15 | Tracking | Execution tự động có `triggeredById = null` | Vẫn được đếm và lọc chính xác theo owner của workflow |
| AC-16 | Dashboard | Lọc thời gian nửa mở `[from, to)` và nhóm ngày qua múi giờ | Không đếm lượt tại thời điểm `to`; các lượt nhóm chính xác theo timezone đã chọn |
| AC-17 | UI | Tab trình duyệt bị ẩn hoặc mạng lỗi | Dừng toàn bộ background polling; hiển thị thông báo lỗi và nút retry thân thiện |
| AC-18 | Connector | Admin xem danh mục Connector | Hiển thị đầy đủ authType, số lượng credentials và số workflows phân biệt sử dụng |
| AC-19 | Connector | Tạo API Key / OAuth khi connector bị cấm tạo mới | Bị từ chối với `409 CONNECTOR_NEW_CREDENTIALS_DISABLED`; UI Client hiển thị trạng thái cấm |
| AC-20 | Node Type | Admin xem danh mục Node Types và tìm kiếm | Lọc theo category, trạng thái hiển thị, hiển thị số workflow draft và published sử dụng |
| AC-21 | Node Type | Tắt hiển thị palette (`isCatalogVisible = false`) | Node bị ẩn khỏi palette Designer; workflow cũ chứa node vẫn chạy bình thường |
| AC-22 | Node Type | Tắt thực thi (`isExecutionAllowed = false`) | Workflow gặp node này khi chạy sẽ fail node với mã lỗi `NODE_TYPE_DISABLED` an toàn |
| AC-23 | Node Type | Server khởi động lại và sync catalog | Cấu hình `isCatalogVisible` và `isExecutionAllowed` của Admin không bị ghi đè |
| AC-24 | Execution | Lọc danh sách execution theo owner, workflow, ID, status, trigger | Kết quả trả về đúng điều kiện lọc, phân trang chính xác, sắp xếp mới nhất trước |
| AC-25 | Execution | Xem chi tiết execution và bảng node execution logs | Chỉ hiển thị metadata an toàn; không chứa input/output/context/prompt/stack trace |
| AC-26 | Execution | Thao tác trên màn hình giám sát execution | Giao diện hoàn toàn chỉ đọc; không có nút Run, Retry, Cancel |
| AC-27 | Audit Log | Xem danh sách và chi tiết Audit Logs | Lọc theo actor/action/target/thời gian; xem được diff Before/After các trường whitelist |
| AC-28 | Audit Log | Toàn vẹn dữ liệu audit | Bảng audit không có API sửa/xóa; mọi thao tác connector/node type ghi nhận atomic |
