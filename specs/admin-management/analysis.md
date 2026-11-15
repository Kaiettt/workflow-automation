# Phân tích chức năng Admin của FlowPilot

Status: ready-for-agent

## 1. Mục tiêu nghiệp vụ

Admin cần quản lý tài khoản, nắm tình hình vận hành toàn hệ thống, kiểm soát việc kết nối dịch vụ ngoài (Connector), điều phối danh mục các loại node (Node Type), giám sát các lượt thực thi (Execution) và tra cứu lịch sử tác động quản trị (Audit Log). Client tiếp tục tự thiết kế, sở hữu và vận hành workflow thuộc quyền của mình mà không bị xâm phạm dữ liệu nhạy cảm.

Nguồn yêu cầu: [PRD](../../docs/prd.md), [SRS](../../docs/srs.md), [thuật ngữ](../../CONTEXT.md). Yêu cầu chi tiết và tiêu chí nghiệm thu nằm trong [spec](spec.md); thứ tự thực hiện nằm trong [plan](plan.md); kiến trúc và hợp đồng nằm trong [design](design.md).

## 2. Phân tích theo nhóm chức năng

| Nhóm | Vấn đề cần giải quyết | Phạm vi nghiệp vụ | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- |
| Quản lý tài khoản (G1, G2) | Cần tra cứu, phân quyền, khóa tài khoản vi phạm hoặc thu hồi quyền Admin | Danh sách, chi tiết, khóa/mở khóa, đổi Client ↔ Admin, vô hiệu hóa phiên tức thì | P0 | Đã hoàn thành (PR #39) |
| Dashboard vận hành (G3) | Admin chưa biết quy mô sử dụng, xu hướng và tỷ lệ lỗi toàn nền tảng | Thống kê tài khoản, workflow, execution, xu hướng ngày và nhóm lỗi chuẩn hóa | P0 | Đã hoàn thành (PR #39) |
| Quản lý connector (G4) | Cần tạm ngừng nhận kết nối mới với một dịch vụ bên thứ ba mà không làm hỏng workflow đang chạy | Tra cứu catalog, xem mức sử dụng (credentials, workflows), bật/tắt chính sách tạo credential mới, audit policy | P1 | Cần đặc tả & triển khai |
| Quản lý loại node (G5) | Cần kiểm soát các block chức năng trong palette, ẩn node lỗi thời/bảo trì mà vẫn đảm bảo workflow cũ chạy | Tra cứu catalog node, bật/tắt hiển thị palette (catalog visibility) vs chặn chạy runtime (execution availability), thống kê sử dụng | P1 | Cần đặc tả & triển khai |
| Giám sát execution (G6) | Cần hỗ trợ xử lý sự cố toàn hệ thống, tìm execution lỗi mà không xâm phạm dữ liệu Client | Danh sách & chi tiết execution toàn nền tảng, bộ lọc đa chiều, metadata an toàn (không payload, token, secret, stack trace) | P1 | Cần đặc tả & triển khai |
| Nhật ký quản trị (G7) | Cần truy vết ai đã thay đổi tài khoản, chính sách connector hay trạng thái node type | Ghi nhận audit atomic cùng transaction; giao diện tra cứu danh sách và chi tiết audit event (read-only) | P1 | P0 đã ghi account; P1 bổ sung connector/node audit & UI tra cứu |

## 3. Ranh giới bảo mật và quyền riêng tư dữ liệu

Admin có quyền quản trị vận hành ở cấp độ metadata toàn nền tảng. Tuy nhiên, kiến trúc FlowPilot đặt ra ranh giới nghiêm ngặt về quyền riêng tư:

1. **Dữ liệu nhạy cảm của Client**: Admin tuyệt đối không được phép xem canvas nội dung, snapshot version, JSON input/output, execution context, biến môi trường, webhook payload thô, AI prompt, stack trace lỗi thô hoặc credentials/secrets/tokens của Client.
2. **Không có thao tác can thiệp thay Client**: Khu vực Admin không cung cấp chức năng chạy thử (Run), chạy lại (Retry), hủy ngang (Cancel), sửa đổi canvas, hoặc xóa workflow thuộc quyền sở hữu của Client.
3. **Phân tách endpoint và chiếu dữ liệu (Projection Whitelisting)**: Admin không được dùng endpoint Client để vượt qua ownership check. Mọi API Admin phải trả về DTO projection riêng biệt được whitelist ở tầng server; frontend tuyệt đối không nhận dữ liệu thô rồi mới ẩn trên giao diện.
4. **Quyền cá nhân của Admin**: Khi Admin tự tạo workflow cho chính mình, Admin hành xử như một Client thông thường và chịu các quy tắc kiểm tra ownership độc lập.

## 4. Các tình huống nghiệp vụ và phân tích quyết định kiến trúc

### 4.1. Khóa Client đang có workflow chạy tự động (Đã chốt tại P0)
- Chặn đăng nhập, vô hiệu hóa access/refresh token ngay lập tức (thông qua `session_version`).
- Chặn mọi lượt khởi chạy mới (manual run, schedule, webhook). Webhook vẫn trả ACK HTTP cho provider để tuân thủ contract nhưng không enqueue job.
- Worker kiểm tra trạng thái owner trước khi chuyển `QUEUED` sang `RUNNING`: nếu owner bị khóa (`isActive = false`), chuyển thành `CANCELLED` với lý do `OWNER_SUSPENDED`.
- Lượt đã ở trạng thái `RUNNING` được phép hoàn tất để tránh ngắt quãng tác vụ bên ngoài.

### 4.2. Quản lý Connector: Phân biệt `Connector.isActive` và `allowNewCredentials` (G4)
- **Vấn đề**: `Connector.isActive` hiện tại trong database chỉ định connector có được hỗ trợ bởi hệ thống hay không (ví dụ package mã nguồn có được nạp hay không). Nếu Admin dùng cờ này để "tạm ngừng cấp credential mới", toàn bộ credential cũ đang tồn tại sẽ bị coi là inactive và workflow của người dùng sẽ gãy ngay lập tức.
- **Quyết định**: 
  - Tách bạch hoàn toàn: `Connector.isActive` (trạng thái catalog/runtime từ code package) và `allowNewCredentials` (chính sách quản trị do Admin cấu hình).
  - Khi `allowNewCredentials = false`:
    - Người dùng không thể tạo mới API Key credential, không thể bắt đầu OAuth flow mới hoặc hoàn tất OAuth callback mới.
    - Các credential đã có tiếp tục hoạt động bình thường: workflow đang dùng credential này vẫn publish, execute và tự động refresh token định kỳ bình thường.
  - Bảng lưu trữ chính sách `connector_policies` riêng biệt để bảo đảm lệnh `PackageCatalogSync` hoặc seed khi khởi động server **không bao giờ ghi đè** cấu hình của Admin.
  - **Xử lý Race Condition**: Người dùng có thể bấm "Connect Google" trước khi Admin tắt chính sách, nhưng quay lại từ Google sau khi chính sách đã bị khóa. Giải pháp: Tại thời điểm ghi nhận credential (callback / complete), backend phải mở transaction, khóa dòng connector policy và kiểm tra lại `allowNewCredentials`. Nếu đã bị tắt, transaction bị từ chối với lỗi `409 Conflict` (mã `CONNECTOR_NEW_CREDENTIALS_DISABLED`).

### 4.3. Quản lý Node Type: Phân tách Catalog Visibility và Execution Availability (G5)
- **Vấn đề**: Khi một loại node gặp sự cố (ví dụ API bên thứ ba thay đổi hoặc node đang bảo trì), Admin cần can thiệp. Nếu xóa node khỏi database hoặc tắt hoàn toàn, các workflow hiện có của người dùng sẽ bị lỗi cú pháp hoặc crash đột ngột.
- **Quyết định**:
  - Hỗ trợ 2 cấp độ kiểm soát độc lập cho từng Node Type:
    1. **Catalog Visibility (`isCatalogVisible`)**: Ẩn/hiện node trên palette của Designer. Khi tắt: người dùng không thể kéo thả thêm node này vào workflow mới, nhưng các workflow cũ vẫn giữ nguyên định nghĩa và chạy bình thường.
    2. **Execution Availability (`isExecutionAllowed`)**: Cho phép/chặn thực thi ở runtime. Mặc định `true`. Khi tắt: nếu một workflow đang chạy gặp node này, engine sẽ dừng node với mã lỗi an toàn `NODE_TYPE_DISABLED`, không gây crash unhandled exception.
  - Thống kê sử dụng: Cung cấp cho Admin biết có bao nhiêu workflow (draft và published) đang chứa node type này để đánh giá tác động trước khi quyết định tắt thực thi.
  - Đồng bộ catalog: Tương tự Connector, cấu hình trạng thái của Admin phải được lưu độc lập (`node_type_policies`) để `PackageCatalogSync` không ghi đè giá trị do Admin thiết lập.

### 4.4. Giám sát Execution: Bảo mật dữ liệu và hiệu năng tra cứu (G6)
- **Vấn đề**: Admin cần tra cứu sự cố của khách hàng (ví dụ: tại sao workflow X bị fail lúc 14:00), nhưng không được phép đọc dữ liệu kinh doanh của khách hàng chứa trong input/output payload hay token trong headers.
- **Quyết định**:
  - API `GET /api/admin/executions` và `GET /api/admin/executions/:id` chỉ trả về **Safe Metadata Whitelist**:
    - Execution level: ID, workflowId, workflowName, ownerId, ownerName, ownerEmail, versionNumber, triggerType, status, queuedAt, startedAt, finishedAt, durationMs, safe errorCode, cancellationReason.
    - Node log level: nodeId, nodeKey, status, startedAt, finishedAt, durationMs, retryCount, safe errorCode.
    - Tuyệt đối loại bỏ: custom node label (có thể chứa thông tin mật), input, output, execution context, error stack trace, raw errorMessage (thay bằng `errorCode` đã được phân loại hoặc `UNCLASSIFIED_ERROR`).
  - Giao diện Admin chỉ đọc (Read-only): Không có nút Run, Retry, Cancel.
  - Polling kiểm soát: Tự động cập nhật mỗi 30 giây nhưng chỉ khi tab trình duyệt đang hiển thị (`document.visibilityState === 'visible'`).

### 4.5. Nhật ký quản trị (Audit Log Viewer): Bất biến và toàn vẹn (G7)
- **Vấn đề**: Cần một hệ thống kiểm toán minh bạch, không thể bị chỉnh sửa hay xóa bỏ bởi bất kỳ Admin nào, ghi nhận đầy đủ mọi thay đổi tài khoản, chính sách connector, và trạng thái node type.
- **Quyết định**:
  - Mọi thao tác quản trị có hiệu lực (`USER_SUSPENDED`, `USER_REACTIVATED`, `USER_ROLE_CHANGED`, `CONNECTOR_POLICY_CHANGED`, `NODE_TYPE_STATUS_CHANGED`, `ADMIN_BOOTSTRAPPED`) phải ghi vào `admin_audit_events` trong **cùng một database transaction** với bản ghi nghiệp vụ.
  - Bắt buộc cung cấp lý do (`reason`) từ 5 đến 500 ký tự.
  - Dữ liệu `before` và `after` được whitelist chặt chẽ (chỉ lưu các trường trạng thái, không snapshot password hay secret).
  - API và UI tra cứu hoàn toàn chỉ đọc (Read-only), sắp xếp mới nhất trước, hỗ trợ lọc theo actor, action, target và thời gian.

## 5. Hiện trạng mã nguồn và khoảng cách triển khai

| Khu vực | Hiện trạng quan sát được | Việc cần làm |
| --- | --- | --- |
| Role & Auth (G1) | Đã có 2 role `CLIENT` và `ADMIN`, xác thực session version, thu hồi token qua outbox Redis | Đã hoàn thành, bảo toàn toàn bộ logic |
| Quản lý tài khoản (G2) | Đã có `UsersPage`, `UserDetailPage`, API user list/detail/workflows, lock/unlock/role commands | Đã hoàn thành, bảo toàn toàn bộ logic |
| Dashboard (G3) | Đã có `DashboardPage`, `GET /api/admin/dashboard`, aggregate PostgreSQL, trend, safe error code | Đã hoàn thành, bảo toàn toàn bộ logic |
| Connector Policy (G4) | Có catalog `Connector`, tạo API Key credential và OAuth2 / Google OAuth; `PackageCatalogSync` đang ghi đè `isActive = true` | Thêm bảng `connector_policies`, tách `allowNewCredentials`, áp dụng gate tại mọi luồng tạo credential, cập nhật sync tránh ghi đè, thêm `ConnectorsPage` và dialog policy |
| Node Type Policy (G5) | Có `NodeTypeDefinition`, `NodeTypesController` trả danh sách cho designer; `PackageCatalogSync` upsert `isActive = true` | Thêm bảng `node_type_policies`, tách `isCatalogVisible` và `isExecutionAllowed`, áp dụng gate ở Designer catalog và NodeRunner, cập nhật sync tránh ghi đè, thêm `NodeTypesPage` và dialog status |
| Execution Monitor (G6) | Có model `Execution`, `ExecutionNodeLog`, engine lưu log; chưa có API hay UI giám sát toàn nền tảng cho Admin | Bổ sung projection an toàn tại `AdminReadPort`, API `GET /api/admin/executions` và `:id`, thêm `ExecutionsPage`, `ExecutionDetailPage`, safe node table, visible polling |
| Audit Log Viewer (G7) | Đã có model `AdminAuditEvent` và ghi nhận sự kiện tài khoản; chưa có API truy vấn hay màn hình hiển thị | Bổ sung API `GET /api/admin/audit-events` và `:id`, ghi nhận thêm sự kiện connector/node-type, thêm `AuditEventsPage` và dialog xem before/after whitelist |
| Điều hướng Admin | Menu Admin mới có `Overview` và `Users` | Bổ sung menu tabs: `Connectors`, `Node Types`, `Executions`, `Audit Logs` |

## 6. Ma trận rủi ro và giải pháp giảm thiểu

| Rủi ro | Mức độ | Hậu quả | Giải pháp giảm thiểu |
| --- | --- | --- | --- |
| Trùng lặp/ghi đè chính sách khi khởi động lại server | Cao | Admin đã tắt connector/node nhưng khởi động lại hệ thống bị bật lại do `PackageCatalogSync` | Lưu chính sách vào bảng riêng biệt (`connector_policies`, `node_type_policies`); `PackageCatalogSync` chỉ cập nhật metadata code, không chạm vào bảng chính sách |
| Race condition ở luồng OAuth callback | Trung bình | Người dùng lấy được credential mới sau khi Admin đã ban hành lệnh khóa connector | Kiểm tra lại chính sách bên trong transaction lưu credential cuối cùng với pessimistic/advisory lock |
| Rò rỉ dữ liệu nhạy cảm của Client qua Execution Viewer | Nghiêm trọng | Vi phạm quyền riêng tư và tiêu chuẩn bảo mật doanh nghiệp | Dùng whitelist projection tĩnh nghiêm ngặt ở tầng query backend; tuyệt đối không select các cột payload, prompt, input, output, stack trace |
| Workflow đang chạy bị dừng đột ngột khi bảo trì Node Type | Cao | Ảnh hưởng dịch vụ của khách hàng mà không có cảnh báo | Tách biệt `isCatalogVisible` (chỉ ẩn khỏi palette tạo mới) và `isExecutionAllowed`. Mặc định chỉ tắt palette trừ khi khẩn cấp |
| Suy giảm hiệu năng khi đếm workflow liên kết với Connector/Node | Trung bình | API danh mục Admin phản hồi chậm khi số lượng workflow lớn | Đếm trên các version đã `PUBLISHED` hiện tại thông qua JSON query có chỉ mục GIN hoặc aggregate định kỳ; thiết lập timeout |

## 7. Các câu hỏi mở (Open Questions)

1. **Phạm vi đếm workflow sử dụng Node Type**: Có nên đếm cả trong bản nháp (`WorkflowDraft`) hay chỉ đếm các phiên bản đã phát hành (`WorkflowVersion` published)?
   - *Đề xuất*: Đếm riêng biệt 2 chỉ số: số workflow đã publish (ảnh hưởng runtime) và số workflow nháp (ảnh hưởng người đang thiết kế).
2. **Cơ chế xử lý khi node bị tắt thực thi (`isExecutionAllowed = false`)**: Khi một node đang chạy bị chặn, workflow nên chuyển trạng thái `FAILED` ngay lập tức hay chuyển sang nhánh error handling (nếu có)?
   - *Đề xuất*: Đánh dấu node log là `FAILED` với mã lỗi chuẩn `NODE_TYPE_DISABLED`; execution chuyển `FAILED` theo quy tắc xử lý lỗi hiện có của engine.
