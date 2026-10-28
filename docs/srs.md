# Software Requirements Specification (SRS)
# FlowPilot – Nền Tảng Workflow Automation


---

## 1. Giới thiệu

### 1.1 Mục đích

Tài liệu này xác định phạm vi, người dùng và các yêu cầu chức năng, phi chức năng của FlowPilot, làm cơ sở cho thiết kế, phát triển và kiểm thử. Các yêu cầu trong tài liệu được xem là mục tiêu cần thực hiện, không hàm ý hệ thống đã có sẵn các chức năng đó.

### 1.2 Phạm vi sản phẩm

FlowPilot là nền tảng workflow automation giúp người dùng thiết kế, cấu hình, kiểm tra, publish và vận hành quy trình nghiệp vụ bằng giao diện kéo thả. Phạm vi MVP bao gồm Workflow Designer, Node Library, Connector Framework, Workflow Execution Engine, Execution Monitor, Workflow Logs, Version Management, xác thực người dùng và quản lý kết nối.

MVP hướng tới hỗ trợ connectors: HTTP, Webhook, Gmail, Google Sheets, Google Drive, và OpenAI. Engine cần hỗ trợ thực thi tuần tự, điều kiện và rẽ nhánh, chạy song song, retry, timeout và xử lý lỗi. Người dùng cần theo dõi trạng thái và lịch sử chạy, đồng thời lưu, so sánh và khôi phục các phiên bản workflow.


### 1.3 Thuật ngữ

| Thuật ngữ | Giải thích |
| --- | --- |
| Workflow | Đồ thị các node và edge mô tả quy trình tự động hóa |
| Node type | Mẫu node trong catalog, định danh bởi `key` |
| Node instance | Một node được đặt trên canvas, có ID, tên, vị trí và config riêng |
| Draft | Definition đang chỉnh sửa; có thể chưa hoàn chỉnh hoặc không hợp lệ |
| Workflow version | Snapshot bất biến được tạo khi publish |
| Execution | Một lần chạy của một workflow version cụ thể |
| Item | Đơn vị dữ liệu `{ json, pairedItem? }` được truyền giữa các node |
| Connector | Cấu hình tích hợp tới dịch vụ ngoài; credential thuộc về một user và connector |
| Modular Monolith | Một ứng dụng backend được chia theo bounded context và các lớp rõ ràng |


---

## 2. Mô tả tổng quan

### 2.1 Đối tượng sử dụng

| Vai trò | Mục tiêu |
| --- | --- |
| Developer / Business User | Tạo tài khoản, thiết kế và publish workflow, kết nối dịch vụ, chạy version và xem kết quả |
| Administrator | Quản trị người dùng và hệ thống theo quyền được cấp |

Các role tài khoản gồm `ADMIN`, `DEVELOPER`, `BUSINESS_USER`. Quyền truy cập tài nguyên phải được kiểm tra ở backend; không được dựa riêng vào trạng thái giao diện.

### 2.2 Ràng buộc MVP

- Backend là modular monolith; PostgreSQL/Prisma lưu workflow, draft, version, credential, execution và log.
- Draft được lưu riêng với version đã publish. Draft được phép invalid; publish mới là ranh giới validation.
- Execution tham chiếu một `WorkflowVersion` cụ thể, không chạy nội dung draft.
- Runtime baseline trong implementation specs là synchronous/manual/linear; PRD target còn yêu cầu schedule/webhook, branching, parallelism, retry, timeout và error handling. Các yêu cầu đích này cần được đưa vào roadmap/spec triển khai.
- Hệ thống không hỗ trợ nhiều người cộng tác chỉnh sửa realtime trên cùng workflow.
- Credential không được nhúng vào workflow definition dưới dạng token hoặc API key.

### 2.3 Tiêu chí thành công sản phẩm

- Người dùng mới có thể tạo và publish một workflow đơn giản trong khoảng 10 phút.
- Nền tảng hỗ trợ connector MVP và có kiến trúc cho phép bổ sung connector.
- Mọi execution có trạng thái rõ ràng, được lưu lịch sử và hỗ trợ điều tra lỗi.
- Người dùng có thể lưu, so sánh và khôi phục version workflow.

Đây là mục tiêu đề xuất trong PRD; cần xác định cách đo và điều kiện kiểm thử trước khi dùng làm tiêu chí release.

---

## 3. Yêu cầu chức năng

Mỗi yêu cầu có mã `FR-<module>-<số>`. Yêu cầu mô tả hành vi đích; trạng thái thực hiện được tổng hợp riêng ở mục 7.

### 3.1 Authentication và Authorization

| Mã | Yêu cầu | Mô tả |
| --- | --- | --- |
| FR-AU-01 | Đăng ký tài khoản | Người dùng đăng ký bằng tên, email, password và role ban đầu `DEVELOPER` hoặc `BUSINESS_USER`; email đã tồn tại phải được phát hiện trước khi gửi mã đăng ký. |
| FR-AU-02 | Xác minh email bằng OTP | Hệ thống gửi OTP 6 chữ số qua email; OTP hết hạn sau 5 phút, chỉ dùng một lần và có thể yêu cầu gửi lại. Xác minh thành công tạo trạng thái email đã xác minh có thời hạn 15 phút để hoàn tất đăng ký. |
| FR-AU-03 | Đăng nhập và hồ sơ | Người dùng đăng nhập bằng email/password và lấy hồ sơ hiện tại qua API xác thực. Giao diện hiển thị danh tính và role của tài khoản đang đăng nhập. |
| FR-AU-04 | Duy trì phiên | Access token có thời hạn 15 phút; refresh token có thời hạn 7 ngày. Refresh phải xác minh token, kiểm tra user còn active, xoay vòng token và cấp cặp token mới. Client tự refresh khi API trả `401`; refresh thất bại thì đăng xuất. |
| FR-AU-05 | Đăng xuất | Người dùng có thể đăng xuất; refresh token/session phía server bị vô hiệu hóa để không tiếp tục dùng trên thiết bị dùng chung. |
| FR-AU-06 | Khôi phục mật khẩu | Người dùng yêu cầu OTP reset qua email, sau đó xác minh OTP và đặt mật khẩu mới cùng xác nhận. OTP reset dùng TTL và quy tắc sử dụng một lần như quy định trong auth spec. |
| FR-AU-07 | Phân quyền | Backend xác thực JWT và áp dụng quyền theo role/ownership cho workflow, version, credential và execution. User chỉ được truy cập tài nguyên mà họ có quyền; endpoint quản trị yêu cầu quyền Admin. |
| FR-AU-08 | Kiểm tra mật khẩu | Mật khẩu đăng ký/đổi mới tối thiểu 8 ký tự, có chữ hoa, chữ thường, chữ số và ký tự đặc biệt; UI phản hồi độ mạnh và lỗi xác nhận mật khẩu trước khi gửi. |
| FR-AU-09 | Quản lý người dùng | Administrator có thể tra cứu và quản lý tài khoản, trạng thái hoạt động và role theo chính sách phân quyền; mọi thay đổi quyền phải được kiểm tra ở backend. |

### 3.2 Workflow Designer và Draft

| Mã | Yêu cầu | Mô tả |
| --- | --- | --- |
| FR-WD-01 | Tạo workflow | Tạo metadata workflow trước khi cho phép tương tác canvas để mọi draft gắn với một workflow ID. |
| FR-WD-02 | Mở workflow | Mở workflow hiện có và nạp definition draft đã lưu; nếu chưa có draft, UI xử lý như graph rỗng theo hợp đồng API. |
| FR-WD-03 | Thiết kế graph | Người dùng thêm, di chuyển, chọn, kết nối và xóa node/edge trên canvas; khi xóa node, các edge nối với node đó cũng bị xóa. |
| FR-WD-04 | Cấu hình node | Properties panel chỉnh `node.data.config`; form được tạo từ metadata/schema của node type và dùng control phù hợp với kiểu field, enum, default và hint giao diện. |
| FR-WD-05 | Lưu draft tự động | Khi graph thay đổi, frontend debounce khoảng 2 giây rồi lưu definition gồm `nodes`, `edges`, `viewport` qua draft API. UI hiển thị trạng thái đang lưu/đã lưu. |
| FR-WD-06 | Khôi phục canvas | Khi mở lại workflow hoặc sau khi restore version thành công, canvas hiển thị đúng nodes, edges và viewport theo definition nhận được. |

Draft API phải trả lỗi not-found nếu workflow cha không tồn tại; upsert chỉ tạo tối đa một draft cho mỗi workflow. Draft được lưu riêng và không tự tạo published version.

### 3.3 Node Library và Config Schema

| Mã | Yêu cầu | Mô tả |
| --- | --- | --- |
| FR-NL-01 | Catalog động | Designer lấy danh sách node type active từ backend thay vì phụ thuộc hoàn toàn vào catalog hardcode. Catalog cung cấp key, tên hiển thị, category, mô tả, icon/màu và config schema. |
| FR-NL-02 | Nhóm node | Palette nhóm theo `TRIGGER`, `LOGIC`, `DATA_PROCESSING`, `INTEGRATION`, `AI`; người dùng có thể tìm/lọc theo tên hoặc nhóm ở giao diện. |
| FR-NL-03 | Catalog MVP | Catalog nền tảng bao gồm `trigger.manual`, `integration.google_sheet.readRows`, `logic.filter`, `data.aggregate`, `integration.gmail.send`, `ai.llm.generate`; node type cụ thể có thể thay đổi theo seed/catalog active. |
| FR-NL-04 | Schema-driven config | `config_schema` mô tả field bắt buộc, kiểu, enum, default, thứ tự hiển thị và các hint UI/runtime như credential reference, expression hoặc multiline. JSON Schema/hint được xử lý ở application layer, không phải constraint của PostgreSQL. |
| FR-NL-05 | Node mở rộng | Engine dispatch theo `node.data.key` tới executor đã đăng ký; không phụ thuộc vào component renderer của React Flow trong `node.type`. |
| FR-NL-06 | Node type mục tiêu PRD | Catalog mục tiêu có Schedule/Webhook trigger; condition, branch và loop; data transform/filter/mapping; integration nodes. Mỗi node phải công bố cấu hình và hành vi runtime trước khi xuất hiện như node khả dụng. |

### 3.4 Connector và Credential

| Mã | Yêu cầu | Mô tả |
| --- | --- | --- |
| FR-CF-01 | Google OAuth | Người dùng kết nối Google qua OAuth authorization-code flow để cấp quyền Sheets read và Gmail send; callback backend lưu credential gắn với user và connector Google. Token không được truyền về frontend. |
| FR-CF-02 | API-key credentials | Người dùng có thể tạo credential API key cho connector hỗ trợ `API_KEY`, gồm Anthropic, OpenAI và Gemini. Có thể liệt kê credential của connector hiện tại; response không bao giờ chứa secret. |
| FR-CF-03 | Credential picker | Properties panel chỉ hiển thị credential của connector/provider tương ứng. Thay provider phải xóa credential đã chọn nếu không còn phù hợp. Credential mới có thể được chọn sau khi lưu thành công. |
| FR-CF-04 | Credential bảo mật | Backend mã hóa credential bằng AES-256-GCM trước khi lưu; chỉ giải mã trong bộ nhớ khi cần gọi dịch vụ. Kiểm tra credential thuộc user hiện tại và connector mong đợi trước khi gọi executor. |
| FR-CF-05 | Credential riêng tư | Không ghi plaintext secret, ciphertext credential, encryption key hoặc token vào workflow definition, execution context, node input/output log, API response hay error message. |
| FR-CF-06 | Bộ connector MVP theo PRD | Mục tiêu hỗ trợ HTTP, Webhook, Gmail, Google Sheets, Google Drive, và OpenAI. Connector phải có contract mở rộng nhất quán; catalog/provider hiện có không thay thế yêu cầu triển khai từng integration này. |
| FR-CF-07 | Quản lý kết nối bởi Admin | Administrator có thể cấu hình, xem trạng thái và quản lý các kết nối dịch vụ bên ngoài theo quyền được cấp; secret không được hiển thị lại khi xem thông tin kết nối. |

MVP credential API yêu cầu không hiển thị lại API key sau khi tạo. Test connection, thu hồi/ngắt kết nối Google và refresh token tự động chưa được xác định đầy đủ trong các đặc tả hiện có.

### 3.5 Publish và Validation

| Mã | Yêu cầu | Mô tả |
| --- | --- | --- |
| FR-PB-01 | Kiểm tra draft | Trước khi publish, backend xác nhận workflow/draft tồn tại, definition không rỗng và các node type có trong catalog. |
| FR-PB-02 | Kiểm tra cấu hình | Mỗi field trong `configSchema.required` phải có giá trị không null/undefined hoặc chuỗi rỗng. Kiểm tra này không gọi dịch vụ ngoài và không mô phỏng runtime. |
| FR-PB-03 | Kiểm tra cấu trúc graph | MVP yêu cầu một trigger hợp lệ, ít nhất một node thao tác/processing, và mọi node thao tác reachable từ trigger qua edge có hướng. Graph runtime vẫn phải thỏa hợp đồng tuyến tính; branching chưa được hỗ trợ. |
| FR-PB-04 | Lỗi validation có cấu trúc | Khi validation thất bại, không tạo version; trả lỗi HTTP 400 với mã/lý do và node/field liên quan khi có thể; lưu danh sách issue vào `workflow_drafts.validation_errors`. |
| FR-PB-05 | Hiển thị lỗi | UI nhóm lỗi theo node, dùng tên node và thông điệp dễ hiểu, đánh dấu node lỗi trên canvas; chọn lỗi sẽ focus/select node và mở properties. Có thể mở lại danh sách lỗi từ giao diện. |
| FR-PB-06 | Publish version | Khi validation thành công, tạo version snapshot mới, tăng số version theo workflow, gán publisher/time và cập nhật `currentVersionId`. Lịch sử version không bị ghi đè. |
| FR-PB-07 | Xóa lỗi cũ | Publish thành công hoặc lưu draft sửa đổi sẽ xóa validation errors đã lưu trước đó. |

Các issue code tối thiểu: `NO_TRIGGER`, `NO_ACTION`, `UNKNOWN_NODE_TYPE`, `REQUIRED_FIELD_MISSING`, `ACTION_UNREACHABLE`.

### 3.6 Execution Engine và Data Model

| Mã | Yêu cầu | Mô tả |
| --- | --- | --- |
| FR-EX-01 | Chạy version đã publish | Người dùng chạy một version cụ thể qua `POST /api/executions` với version ID. Backend kiểm tra quyền truy cập, tải definition bất biến và tạo execution có tham chiếu tới workflow/version. |
| FR-EX-02 | Manual synchronous run | MVP hỗ trợ manual trigger. HTTP request trả kết quả sau khi traversal hoàn tất; execution lưu actor, trigger type, status, thời gian bắt đầu/kết thúc và duration. |
| FR-EX-03 | Tuyến tính có hướng | Runtime chỉ chạy chuỗi tuyến tính được biểu diễn bởi edges theo hợp đồng execution. Edge rỗng, đứt chuỗi hoặc graph branching không được âm thầm chạy như graph hợp lệ; workflow dừng với lỗi có thể chẩn đoán. |
| FR-EX-04 | Registry executor | Chọn executor bằng `node.data.key`; thiếu executor hoặc executor lỗi làm node và execution thất bại, dừng các node tiếp theo. Mỗi node đã thăm có một node log. |
| FR-EX-05 | Item contract | Dữ liệu node-to-node là `Item[]`, mỗi item có `json` và có thể có `pairedItem`. Executor khai báo `per_item` hoặc `once`; engine thực hiện lặp/gắn paired item cho `per_item`. |
| FR-EX-06 | Output node | Output mặc định chỉ chứa kết quả của node hiện tại. Filter có thể giữ nguyên item đầu vào; Aggregate gom các JSON đầu vào thành một item. `per_item` có thể bỏ item bằng output rỗng/null; không có item đầu vào thì node trả thành công với output rỗng theo hợp đồng. |
| FR-EX-07 | Expression resolver | Hỗ trợ truy cập dữ liệu an toàn qua `{{$json...}}`, `{{$node["Name"].json...}}`, `{{$node["Name"].all}}` và cú pháp tương thích ngược `{{name}}`. Không hỗ trợ JavaScript, `eval`, hàm hoặc phép toán. |
| FR-EX-08 | Phạm vi expression | Chỉ resolve field được đánh dấu `x-allowExpression`; biểu thức đơn giữ kiểu dữ liệu, biểu thức trong chuỗi nội suy thành text. `$node[].json` dùng paired item; `.all` lấy output đầy đủ. Lỗi cú pháp, node chưa chạy/không tồn tại/tên trùng hoặc paired item không xác định phải làm node thất bại với thông tin hữu ích. |
| FR-EX-09 | Default config | Trước khi chạy, engine áp dụng default của schema cho key còn thiếu. `credential_id` và field xác định connector không được resolve như expression. |
| FR-EX-10 | Bảo vệ credential | Engine kiểm tra owner và connector/provider mong đợi, giải mã credential một lần cho node và chỉ truyền giá trị cần thiết cho executor. |
| FR-EX-11 | Chạy tuyến tính từng item | Node `per_item` xử lý lần lượt từng item ở MVP. Nếu item thứ k thất bại, node/execution thất bại, không truyền output một phần sang node kế tiếp; log có summary `total_items`, `processed`, `failed_at_index`. |
| FR-EX-12 | Trigger theo lịch và webhook | Ngoài manual run, workflow có thể được kích hoạt theo cấu hình schedule (cron) hoặc nhận webhook phù hợp với cấu hình trigger đã publish. |
| FR-EX-13 | Conditional branch | Engine hỗ trợ điều kiện và nhiều đường xử lý; chỉ nhánh phù hợp được thực thi theo kết quả điều kiện. |
| FR-EX-14 | Parallel execution | Các nhánh độc lập có thể chạy song song mà không chặn execution/workflow khác; cần bảo toàn kết quả và trạng thái của từng nhánh. |
| FR-EX-15 | Retry | Người dùng/cấu hình node có thể xác định số lần thử lại và khoảng chờ cho lỗi tạm thời; log thể hiện số retry đã thực hiện. |
| FR-EX-16 | Timeout | Node có thể được cấu hình thời hạn chạy; khi vượt quá thời hạn node được đánh dấu thất bại do timeout và xử lý theo policy lỗi. |
| FR-EX-17 | Error handling policy | Workflow có thể quy định dừng toàn workflow, bỏ qua lỗi hoặc chuyển execution sang luồng xử lý lỗi; lỗi không được làm crash engine. |

Node type mục tiêu gồm các nhóm Trigger, Logic, Data Processing, Integration và AI. Runtime baseline hiện đã được đặc tả cho Manual Trigger (`once`), Google Sheets Read Rows (`once`), Filter (`per_item`), Aggregate (`once`), Gmail Send (`per_item`) và LLM Generate (`per_item`). Schedule/Webhook, IF/Branch/Loop, parallel execution và các policy retry/timeout/error tổng quát là yêu cầu PRD chưa được bao phủ bởi runtime contract tuyến tính hiện tại.

### 3.7 LLM Node

| Mã | Yêu cầu | Mô tả |
| --- | --- | --- |
| FR-LLM-01 | Node generate | `ai.llm.generate` thuộc category `AI`, nhận prompt và trả kết quả văn bản hoặc JSON; đây là node trong workflow, không phải trợ lý tạo workflow. |
| FR-LLM-02 | Provider và config | Hỗ trợ provider `anthropic`, `openai`, `gemini`; config gồm credential, model, prompt, tùy chọn system prompt, output format, `max_tokens`, temperature và `max_items`. Prompt/system prompt hỗ trợ expression theo schema. |
| FR-LLM-03 | Per-item | Một item đầu vào tạo một item kết quả. Dùng Aggregate trước node nếu cần gửi danh sách gộp trong một lần gọi. Kết quả có `text`, `model`, token `usage`; JSON mode thêm `data` đã parse. |
| FR-LLM-04 | Giới hạn nền tảng | Mặc định `max_items` là 50 và platform ceiling mặc định là 100 (cấu hình `LLM_MAX_ITEMS`). Nếu số item vượt giới hạn hiệu lực, node thất bại trước khi gọi provider; không cắt dữ liệu âm thầm. |
| FR-LLM-05 | Lỗi và retry | Mỗi provider call có timeout 60 giây; tối đa 2 lần retry cho lỗi retryable như timeout, HTTP 408/429/5xx. JSON không hợp lệ hoặc lỗi không retryable làm node thất bại. API key phải được redacted khỏi lỗi. |
| FR-LLM-06 | Chi phí và key | Người dùng cung cấp API key của mình. Usage token được ghi ở output để người dùng theo dõi; nền tảng không cam kết ước tính chi phí tiền tệ. |

### 3.8 Workflow Version, History và Restore

| Mã | Yêu cầu | Mô tả |
| --- | --- | --- |
| FR-VM-01 | Danh sách workflow | Người dùng xem danh sách workflow thuộc quyền của mình; mỗi workflow có thể mở designer hoặc xem version history. |
| FR-VM-02 | Danh sách và chi tiết version | Version list sắp xếp mới nhất trước và chỉ trả metadata; version detail trả snapshot definition. Người dùng có thể xem node summary và chạy version đó. |
| FR-VM-03 | Restore version | Restore definition của version đã chọn vào draft, không sửa version lịch sử. Backend tự đọc snapshot từ database, xác minh version thuộc workflow và thực hiện các cập nhật liên quan trong transaction. |
| FR-VM-04 | Phát hiện draft chưa publish | API trả `hasDraft`, `hasUnpublishedChanges`, version đang publish và thời điểm cập nhật draft để UI chọn luồng restore an toàn. |
| FR-VM-05 | Xử lý xung đột restore | Khi draft có thay đổi chưa publish, người dùng chọn `PUBLISH_THEN_RESTORE`, `BACKUP_THEN_RESTORE` hoặc `OVERWRITE`; có thể hủy mà không thay đổi canvas. Khi draft sạch, UI có thể restore trực tiếp bằng overwrite. |
| FR-VM-06 | Làm mới sau restore | Sau restore thành công, canvas nạp definition mới và UI thông báo kết quả. Backup strategy tạo workflow riêng giữ nguyên draft chưa publish. |
| FR-VM-07 | So sánh version | Người dùng chọn hai version của cùng workflow và xem các khác biệt trong definition để hiểu thay đổi trước khi restore hoặc tiếp tục chỉnh sửa. |

PRD yêu cầu compare; chi tiết cách trình bày diff cần được đặc tả. Merge/three-way merge chưa được yêu cầu. `PUBLISH_THEN_RESTORE` phải tuân theo transaction và quy tắc version bất biến; version mới được tạo từ draft cũ trước khi draft nhận snapshot được restore.

### 3.9 Execution Monitor và Logs

| Mã | Yêu cầu | Mô tả |
| --- | --- | --- |
| FR-EM-01 | Kết quả run | Sau manual run, UI hiển thị execution status và trạng thái từng node; lỗi hiển thị message đã được làm sạch secret. |
| FR-EM-02 | Thời gian | Lưu/hiển thị thời gian bắt đầu, kết thúc và duration của execution và node log. |
| FR-EM-03 | Item counts | Với log theo item, hiển thị số item vào/ra khi dữ liệu log tương thích với định dạng item array. |
| FR-EM-04 | Giám sát gần thời gian thực | Monitor phản ánh trạng thái `RUNNING`, `SUCCESS` hoặc `FAILED` trong thời gian thực hoặc gần thời gian thực khi runtime hỗ trợ execution kéo dài/không đồng bộ. |
| FR-EM-05 | Retry count | Monitor hiển thị số lần retry của từng node trong một execution. |
| FR-EM-06 | Cảnh báo lỗi | Người dùng liên quan được thông báo khi workflow execution thất bại để có thể xử lý; kênh và cấu hình người nhận cần được đặc tả riêng. |
| FR-EM-07 | Lịch sử execution | Người dùng xem các execution gần đây của workflow và lọc theo trạng thái. |
| FR-LG-01 | Node logs | Lưu execution ID, node instance ID/key, status, input/output, error message/stack nếu có, retry count và timing. Không tạo log riêng cho từng item hoặc từng email trừ khi yêu cầu tương lai quy định khác. |
| FR-LG-02 | Truy vết lỗi | Execution dừng ở node lỗi; log lưu node thất bại và các node chưa chạy không được giả lập là thành công. Error summary phải hữu ích nhưng không chứa secret. |
| FR-LG-03 | Bảo toàn log cũ | Thay đổi định dạng log của execution mới không yêu cầu migration dữ liệu execution cũ. |
| FR-LG-04 | Tra cứu log | Người dùng có thể tra cứu/lọc execution log theo workflow, khoảng thời gian và trạng thái để hỗ trợ debug/audit. |

Runtime baseline hiện trả kết quả của lần run từ version detail; màn hình history/filter và cập nhật trạng thái gần realtime là mục tiêu PRD cần bổ sung ngoài contract run đồng bộ hiện tại.

---

## 4. Yêu cầu phi chức năng

| Mã | Nhóm | Yêu cầu |
| --- | --- | --- |
| NFR-01 | Kiến trúc | Backend theo modular monolith, Clean Architecture và CQRS; module giao tiếp qua service/port rõ ràng thay vì truy cập trực tiếp data access của module khác. |
| NFR-02 | Bảo mật tài khoản | Password lưu dưới dạng bcrypt hash; OTP và refresh token lưu Redis với TTL, không lưu OTP trong PostgreSQL hoặc log. SMTP chỉ cấu hình qua biến môi trường. |
| NFR-03 | Bảo mật credential | Connector secrets mã hóa AES-256-GCM tại application layer; khóa mã hóa lấy từ cấu hình bảo mật; tuyệt đối không trả/lưu plaintext trong log, API response hay workflow definition. |
| NFR-04 | Authorization | Endpoint riêng tư yêu cầu JWT; mọi truy cập workflow/version/credential/execution phải kiểm tra ownership hoặc role phía server. |
| NFR-05 | An toàn expression | Bộ resolve chỉ parse đường dẫn dữ liệu, không thực thi code người dùng. |
| NFR-06 | Độ tin cậy | Lỗi node/provider phải chuyển trạng thái node/execution phù hợp và không làm crash tiến trình backend. Các node sau lỗi không được chạy tiếp trong execution tuyến tính. |
| NFR-07 | Tính nhất quán | Publish/restore phải bảo toàn version bất biến; các thao tác nhiều bước có khả năng mất dữ liệu phải dùng transaction. Version number không được trùng trong cùng workflow. |
| NFR-08 | Khả năng quan sát | Execution/node log có trạng thái, timing, input/output và thông tin lỗi đã redacted. MVP trả trạng thái sau synchronous run, không cam kết monitor realtime cho execution nền. |
| NFR-09 | Khả năng mở rộng | Catalog/schema cho phép thêm node/connector mà không hardcode từng form hoặc dispatch vào core engine. Tăng trưởng log cần được theo dõi; partition/archive là quyết định vận hành tương lai, chưa phải tính năng MVP. |
| NFR-10 | Khả năng tương thích | Workflow đã publish phải chạy theo version snapshot. Thay đổi executor/schema phải cân nhắc workflow cũ, gồm legacy expression và default config đã được định nghĩa. |

---

## 5. Kiến trúc hệ thống tổng quan

Các bounded context chính:

- **Authentication:** đăng ký, xác minh email, session/token và quyền truy cập.
- **Designer:** workflow metadata, draft, publish validation, version list/detail/restore.
- **Node Library:** catalog node types và config schemas.
- **Connector:** OAuth/API-key credential, encryption và truy xuất credential.
- **Execution:** tải version, điều phối node, item/expression engine và executor registry.
- **Logging/Monitoring:** execution record, node logs và kết quả trả cho client.

Frontend dùng feature-based architecture. Designer canvas dùng React Flow; API/server state đi qua service/client và query hooks theo quy ước frontend. Backend là một deployment modular monolith ở MVP; khả năng tách module thành service sau này là mục tiêu kiến trúc, không phải yêu cầu deploy microservice hiện tại.

---

## 6. Ngoài phạm vi MVP / Giai đoạn sau

Các tính năng ngoài phạm vi hoặc hướng phát triển sau:

- Marketplace, distributed execution quy mô lớn và multi-region deployment.
- Real-time collaborative editing.
- Expression autocomplete, preview, JavaScript/functions/arithmetic; binary/file items và Split node.
- LLM streaming, chat nhiều lượt, tools, ảnh/file, dynamic model discovery, custom OpenAI-compatible base URL, JSON Schema validation tùy biến và chi phí tiền tệ.
- FlowPilot AI assistant/generate/explain/review/optimize workflow, Human-in-the-loop, AI Debugger, template gallery, local LLM và nhiều workflow engine qua Workflow IR.
- Connector marketplace hoặc hàng trăm connector dựng sẵn.

---
