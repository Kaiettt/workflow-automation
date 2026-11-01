# BÁO CÁO TIẾN ĐỘ TUẦN 08

## 1. Thông tin chung

- **Tên đề tài:** CrabFlowPilot – Nền tảng thiết kế và tự động hóa quy trình (Workflow Automation)
- **Học kỳ:** Học kỳ 1, năm học 2026–2027
- **Tuần báo cáo:** Tuần 08
- **Thời gian báo cáo:** 26/10/2026 – 01/11/2026
- **Sinh viên thực hiện:** 
  - Nguyễn Anh Kiệt – MSSV: 23110246
  - Nguyễn Văn Hiếu – MSSV: 23110214
- **Giảng viên hướng dẫn:** ThS. Nguyễn Hữu Trung
- **Mã nguồn dự án:** `workflow-automation`
- **Nhánh làm việc:** `feat/chat-trigger`
- **Ngày chốt số liệu:** 01/11/2026

---

## 2. Mục tiêu của tuần

Tiếp nối thành công của cơ chế *Workflow Publish Validation* và hạ tầng kiểm thử giao diện trong Tuần 07, trọng tâm của Tuần 08 là một bước nhảy vọt về kiến trúc cốt lõi của hệ thống: **Chuyển đổi toàn diện từ mô hình thực thi chuỗi tuần tự (linear pipeline) sang mô hình đồ thị có hướng phân nhánh (Directed Acyclic Graph - DAG with Named Outputs)**, đồng thời xây dựng hoàn chỉnh **hệ sinh thái Chatbot thông minh, tích hợp đa kênh bên ngoài (Webhook, Facebook Messenger) với hàng đợi bất đồng bộ BullMQ và bộ nhớ hội thoại nhiều lượt (Chat Memory)**.

Trước đây, hệ thống chỉ chấp nhận quy trình chạy tuyến tính đơn giản: một Trigger nối tiếp qua từng Action thành một đường thẳng duy nhất, kích hoạt thủ công đồng bộ qua HTTP. Điều này giới hạn tính ứng dụng thực tế khi doanh nghiệp cần rẽ nhánh điều kiện (IF/Switch), cần kích hoạt từ các sự kiện webhook bên ngoài hay tin nhắn khách hàng trên mạng xã hội, hoặc cần xây dựng các trợ lý AI có khả năng ghi nhớ hội thoại nhiều lượt.

Các mục tiêu cụ thể được đặt ra và hoàn thành trong tuần:

1. **Tái cấu trúc Engine thực thi theo đồ thị DAG & Named Outputs:**
   - Hỗ trợ các node phân nhánh đa cổng (Multi-output branching) với các cổng ra có tên định danh (`x-outputs`).
   - Sắp xếp thứ tự thực thi các node theo thuật toán sắp xếp tô-pô (Topological Sort).
   - Cơ chế kích hoạt cạnh có điều kiện (`active edges`) và tự động ghi nhận trạng thái `SKIPPED` cho các nhánh không thỏa mãn.
   - Cơ chế lần ngược dữ liệu thông minh qua các nhánh (`Item Pairing` hồi quy) phục vụ truy xuất biểu thức `$node["..."]`.
2. **Kiến trúc thực thi nền bất đồng bộ với BullMQ & Redis cho App Triggers:**
   - Tách biệt hoàn toàn `WorkflowEngine` ra khỏi HTTP Request-Response lifecycle.
   - Hiện thực hóa `trigger.webhook`: tiếp nhận HTTP POST, phản hồi ngay `202 Accepted` và đẩy tác vụ vào hàng đợi BullMQ chạy nền.
   - Cơ chế phòng chống gửi lặp với `Idempotency-Key` lưu vết trên Redis.
   - Quản trị vòng đời trigger (`workflow_triggers`, `webhook_endpoints`) và trạng thái kích hoạt `active` của quy trình.
3. **Hiện thực hóa tích hợp Facebook Messenger toàn diện:**
   - Tích hợp chuẩn giao thức OAuth2 với Meta Graph API (quản lý Fanpages, Page Access Token, App Secret).
   - Node `Messenger Trigger`: tiếp nhận webhook tin nhắn khách hàng (`messages`), sự kiện nhấn nút (`postbacks`) và chọn nhanh (`quick_reply`). Hỗ trợ lọc theo loại sự kiện và từ khóa (keyword matching).
   - Node `Messenger Send Message`: gửi tin nhắn văn bản, danh sách lựa chọn nhanh (Quick Replies lên đến 13 nút), mẫu nút bấm (Button Template) và tập tin đa phương tiện (ảnh, video, audio, file) qua URL. Tự động kiểm tra giới hạn của Meta và xử lý cửa sổ 24 giờ.
   - Node `Messenger Sender Action`: hiển thị trạng thái đang soạn tin (`typing_on`, `typing_off`) hoặc đánh dấu đã đọc (`mark_seen`).
   - Kiểm tra chữ ký HMAC SHA256 (`X-Hub-Signature-256`) chống giả mạo request từ bên thứ ba.
4. **Xây dựng Bộ nhớ hội thoại (Chat Memory) và nâng cấp AI LLM:**
   - Node `Chat Memory`: lưu trữ và truy xuất lịch sử đàm thoại đa lượt (Multi-turn conversation) trên Redis theo `session_key` (ví dụ `sender_id` của khách hàng), hỗ trợ cửa sổ trượt (windowing) và thời gian sống (TTL).
   - Nâng cấp node `LLM`: tiếp nhận tham số `history` từ Chat Memory, chuyển đổi định dạng và truyền vào lịch sử đàm thoại của OpenAI (GPT), Anthropic (Claude) và Google (Gemini).
5. **Bộ node điều hướng dữ liệu & Logic:**
   - Node `IF`: rẽ nhánh nhị phân thành 2 cổng `true` / `false` dựa trên 12 toán tử so sánh, hỗ trợ kết hợp điều kiện `AND`/`OR`, không phân biệt hoa thường và tự động chuẩn hóa dấu tiếng Việt (`ignore_accents`).
   - Node `Switch`: rẽ nhánh đa cổng theo danh sách quy tắc người dùng định nghĩa, kèm cổng mặc định `fallback`, hỗ trợ chế độ duyệt `first` hoặc `all`.
   - Node `Edit Fields` (Set): bổ sung, chỉnh sửa hoặc tinh giản các trường dữ liệu trong item theo biểu thức động hoặc giá trị tĩnh.
6. **Node HTTP Request vạn năng & Bảo vệ an ninh SSRF Guard:**
   - Thực hiện gọi API tùy ý (GET, POST, PUT, PATCH, DELETE, HEAD) với 4 phương thức xác thực (None, Header, Bearer, Basic).
   - Module `safeRequest`: tích hợp cơ chế SSRF Guard (Server-Side Request Forgery) kiểm tra DNS trước khi kết nối, chặn truy cập dải mạng nội bộ/private IP, ghim địa chỉ IP (connection pinning), theo dõi chuyển hướng thủ công (manual redirect) và giới hạn kích thước phản hồi 5MB.
7. **Nâng cấp giao diện người dùng (Canvas & Designer Redesign):**
   - Thiết kế lại thẻ node (`BaseNode`): bổ sung icon tile, phân loại node rõ ràng, cổng kết nối hiển thị theo nhãn (labeled handles) cho các output có tên.
   - Đường nối mượt mà (`smoothstep`) kèm mũi tên chỉ hướng dòng chảy dữ liệu, nền lưới chấm hiện đại (dotted canvas) và minimap phân màu theo loại node.
   - Tích hợp công tắc kích hoạt quy trình (`ActiveToggle`), hộp thoại cấu hình tài khoản kết nối OAuth2 (`AddCredentialDialog`) và bảng hiển thị URL Webhook dùng thử.
8. **Mở rộng vượt bậc hệ thống kiểm thử tự động:**
   - Tăng cường số lượng test case từ **213** lên **489** unit tests ở Backend (29 test suites) và từ **7** lên **29** component/unit tests ở Frontend (10 test files).
   - Tỷ lệ kiểm thử thành công đạt **100% PASS** trên toàn bộ hệ thống.

---

## 3. Nội dung công việc đã thực hiện

### 3.1. Kiến trúc thực thi đồ thị có hướng (DAG Execution Engine with Named Outputs)

Nhóm đã tái cấu trúc hoàn toàn tầng lõi `monolith-backend/libs/execution`:

```
                    +--------------------+
                    |  Messenger Trigger |
                    +---------+----------+
                              |
                              v
                    +--------------------+
                    |    Chat Memory     |
                    |    (mode: load)    |
                    +---------+----------+
                              |
                              v
                    +--------------------+
                    |       Switch       |
                    +---+------------+---+
        [Hỏi giá]      |            |      [Tư vấn khác / Fallback]
       +---------------+            +---------------+
       |                                            |
       v                                            v
+--------------------+                       +--------------------+
| Messenger Action:  |                       |      Node LLM      |
| Bảng giá dịch vụ   |                       | (OpenAI / Claude)  |
+--------------------+                       +---------+----------+
                                                       |
                                                       v
                                             +--------------------+
                                             | Messenger Action:  |
                                             | Gửi câu trả lời    |
                                             +---------+----------+
                                                       |
                                                       v
                                             +--------------------+
                                             |    Chat Memory     |
                                             |    (mode: save)    |
                                             +--------------------+
```

#### a. Thuật toán sắp xếp tô-pô (Topological Sort)
- Đồ thị workflow được biểu diễn dưới dạng danh sách kề có hướng.
- `WorkflowEngine` kiểm tra tính hợp lệ của đồ thị (không chứa chu trình khép kín - cycle detection), xác định duy nhất một điểm bắt đầu (Trigger node) và tính toán thứ tự thực thi của các node theo thuật toán sắp xếp tô-pô Kahn's Algorithm.

#### b. Cổng ra có tên (Named Outputs) & Định tuyến Item (RoutedItem)
- Các node logic như `IF` (có 2 cổng: `true`, `false`) hay `Switch` (các cổng theo rule name + `fallback`) phát ra dữ liệu dạng `RoutedItem(outputName, item)`.
- Một cạnh (edge) kết nối từ cổng `sourceHandle` tới node kế tiếp chỉ được xem là `active` khi node nguồn thực sự phát item tới đúng cổng đó.
- Nếu một node không có bất kỳ cạnh đi vào nào ở trạng thái active (do nhánh điều kiện trước đó không rẽ vào), node đó được đánh dấu trạng thái `SKIPPED`, giúp tối ưu tài nguyên và hiển thị trực quan trên giao diện lịch sử chạy.

#### c. Cơ chế hồi quy Item Pairing (`$node["..."]`)
- Trong mô hình phân nhánh, khi một node tham chiếu dữ liệu từ node tổ tiên qua biểu thức `{{$node["Tên Node"].json.field}}`, hệ thống lần ngược cây phả hệ (ancestry tree) của từng item để ghép đúng bản ghi đã tạo ra nó, đảm bảo tính nhất quán dữ liệu ngay cả khi qua nhiều tầng rẽ nhánh và gộp luồng.
- Bổ sung cơ chế gợi ý thông minh (Did you mean...): khi người dùng gõ sai hoa thường hoặc khoảng trắng tên node trong biểu thức, hệ thống tự động tìm node gần đúng nhất và gợi ý trong thông báo lỗi.

---

### 3.2. Hạ tầng thực thi nền & Tích hợp App Triggers (BullMQ, Redis, Webhooks)

Để hỗ trợ các quy trình kích hoạt từ bên ngoài mà không làm nghẽn luồng xử lý HTTP API, nhóm xây dựng module `monolith-backend/libs/triggers` và mở rộng `execution`:

```
[External Webhook / Meta Messenger]
                │
                ▼
      [WebhooksController]
                │
   (Kiểm tra xác thực / HMAC / Dedup)
                │
                ▼
      [ExecutionQueuePort] ──────────► [BullMQ Queue (Redis)]
                │                               │
        (Trả về 202 Accepted)                   ▼
                                      [ExecutionProcessor]
                                                │
                                                ▼
                                      [WorkflowEngine.execute]
```

#### a. Hàng đợi BullMQ và Xử lý tiến trình nền
- Tích hợp BullMQ kết nối tới Redis cluster. Khi có webhook hoặc tin nhắn gửi tới, hệ thống tiếp nhận, trích xuất dữ liệu, tạo bản ghi `Execution` ở trạng thái `QUEUED` và phản hồi mã HTTP `202 Accepted` trong vài mili-giây.
- `ExecutionProcessor` ở chế độ background worker sẽ nhận job từ queue, phân giải định nghĩa phiên bản quy trình (`WorkflowVersion`) và thực thi đồ thị.
- Tự động dọn dẹp các execution bị treo ở trạng thái `RUNNING` khi server khởi động lại bất ngờ.

#### b. Quản lý vòng đời Webhook & Điểm lắng nghe (Webhook Endpoints)
- Bảng cơ sở dữ liệu mới `workflow_triggers` và `webhook_endpoints`: lưu trữ mapping giữa URL token bí mật với phiên bản quy trình đang hoạt động.
- Token webhook được giữ cố định qua các lần Publish, giúp URL webhook của người dùng không bị thay đổi khi cập nhật logic quy trình.
- Khi người dùng bật/tắt công tắc `active` của quy trình, hệ thống tự động đồng bộ việc đăng ký hoặc hủy đăng ký webhook với các nền tảng bên ngoài.
- Hỗ trợ tiêu đề `Idempotency-Key`: ngăn chặn xử lý trùng lặp khi bên gửi thực hiện retry.

---

### 3.3. Tích hợp Facebook Messenger toàn diện & Bộ nhớ hội thoại

Một trong những thành tựu nổi bật nhất của Tuần 08 là khả năng biến CrabFlowPilot thành nền tảng xây dựng **Chatbot AI tự động cho Fanpage Facebook**:

```
[Khách nhắn tin Fanpage] 
           │
           ▼
[POST /api/webhooks/messenger] ──► Kiểm tra X-Hub-Signature-256 (HMAC SHA256)
           │
           ▼
[Messenger Trigger] ─────────────► Trích xuất: sender_id, text, postback payload
           │
           ▼
[Messenger Sender Action] ───────► Gửi typing_on (khách thấy "Đang soạn tin...")
           │
           ▼
[Chat Memory (load)] ────────────► Nạp 10 tin nhắn gần nhất từ Redis theo sender_id
           │
           ▼
[LLM (OpenAI / Claude)] ─────────► Sinh câu trả lời thông minh dựa vào ngữ cảnh
           │
           ▼
[Messenger Send Message] ────────► Gửi câu trả lời + Quick Replies tới khách
           │
           ▼
[Chat Memory (save)] ────────────► Ghi nhận lượt hỏi đáp vào Redis (TTL: 7 ngày)
```

#### a. Node `Messenger Trigger` (`messenger.trigger`)
- Tiếp nhận sự kiện Webhook từ Meta Graph API.
- Hỗ trợ đa dạng sự kiện: Tin nhắn văn bản (`messages`), Sự kiện bấm nút Postback (`messaging_postbacks`) và Bấm nút chọn nhanh Quick Replies.
- Cung cấp bộ lọc sự kiện: `all` (cả hai), `message` (chỉ tin nhắn), `postback` (chỉ nút bấm).
- Hỗ trợ lọc từ khóa thông minh (`keywords`): chỉ kích hoạt khi tin nhắn hoặc payload chứa các từ khóa quy định (tự động chuẩn hóa chữ hoa/thường và dấu).

#### b. Node `Messenger Send Message` (`messenger.sendMessage`)
- Gửi phản hồi trực tiếp tới người dùng qua PSID (`recipient_id`).
- Hỗ trợ 4 định dạng tin nhắn phong phú:
  1. **Text Message:** Tin nhắn văn bản thuần túy (tối đa 2.000 ký tự).
  2. **Quick Replies:** Gửi kèm tối đa 13 nút gợi ý hành động nhanh ở dưới chân tin nhắn.
  3. **Button Template:** Mẫu tin nhắn kèm các nút bấm (Postback button hoặc Web URL button) tối đa 3 nút.
  4. **Media Attachments:** Gửi hình ảnh, video, âm thanh hoặc tài liệu đính kèm thông qua đường link URL.
- Kiểm tra chặt chẽ các giới hạn ký tự của Meta và kiểm soát cửa sổ 24 giờ của chính sách Facebook Messenger.

#### c. Node `Messenger Sender Action` (`messenger.senderAction`)
- Cho phép quy trình gửi tín hiệu tương tác thời gian thực tới giao diện Messenger của khách hàng:
  - `typing_on`: Hiển thị bong bóng "Đang soạn tin..." trong lúc AI đang suy nghĩ hoặc API đang xử lý.
  - `typing_off`: Tắt hiển thị đang soạn tin.
  - `mark_seen`: Đánh dấu tin nhắn của khách hàng là "Đã xem" (hiển thị avatar nhỏ).

#### d. Node `Chat Memory` (`memory.chat`)
- Lưu trữ trạng thái hội thoại đa lượt độc lập cho từng người dùng dựa trên `session_key` (ánh xạ từ `sender_id`).
- Vận hành trên Redis với cấu trúc danh sách tuần tự (FIFO sliding window tối đa 50 tin nhắn).
- Cung cấp 3 chế độ linh hoạt:
  - `load`: Đọc lịch sử trò chuyện, định dạng thành mảng đối tượng `{ role, content }` (`history`) và chuỗi văn bản (`history_text`).
  - `save`: Lưu một lượt hỏi-đáp mới (`user_message` và `assistant_message`).
  - `clear`: Xóa sạch bộ nhớ hội thoại khi cuộc trò chuyện kết thúc.
- Cấu hình số lượt tải (`window`) và thời gian tự động hết hạn (`ttl_days`).

---

### 3.4. Nâng cấp Node AI LLM: Đàm thoại đa lượt (Multi-turn Context)

Node `LLM` (`ai.llm.generate`) được nâng cấp toàn diện:
- Tiếp nhận trường `history`: khi kết nối với output của node `Chat Memory`, LLM tự động nạp các lượt trao đổi trước đó vào ngữ cảnh.
- Tương thích đa nền tảng:
  - **OpenAI:** Chuyển đổi mảng history thành danh sách message chuẩn của OpenAI SDK (`role: 'user' | 'assistant'`).
  - **Anthropic Claude:** Định dạng turns message chuẩn Claude Messages API.
  - **Google Gemini:** Chuyển đổi thành cấu trúc `contents: [{ role: 'user' | 'model', parts }]`.
- Đảm bảo tính mềm dẻo khi người dùng có thể lựa chọn định dạng đầu ra `text` hoặc `json`.

---

### 3.5. Node HTTP Request vạn năng & Bảo mật an ninh SSRF Guard

Node `http.request` cho phép quy trình tương tác với bất kỳ hệ thống bên ngoài nào qua giao thức HTTP:
- Hỗ trợ đầy đủ phương thức: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`.
- Hỗ trợ biểu thức động trong URL, Query parameters, Headers và Request Body (JSON, Form URL encoded, Text).
- Tích hợp 4 loại chứng thực: Không xác thực, Header API Key, Bearer Token, Basic Auth.
- **Tầng bảo vệ an ninh SSRF Guard (`safeRequest`):**
  - Giải quyết bài toán bảo mật nghiêm trọng khi cho phép người dùng tự do nhập URL trong môi trường doanh nghiệp.
  - Phân giải DNS trước khi mở socket, đối chiếu IP với các dải mạng riêng tư/nội bộ (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, loopback `127.0.0.1`, link-local, multicast, metadata service `169.254.169.254`). Chặn đứng mọi hành vi thăm dò mạng nội bộ.
  - Ghim kết nối (Connection Pinning): mở socket trực tiếp tới đúng IP đã kiểm tra, chống lại kỹ thuật tấn công DNS Rebinding.
  - Tự động hủy token/credentials khi gặp chuyển hướng (redirect) sang tên miền khác (cross-host redirect).
  - Giới hạn dung lượng tải về tối đa 5MB chống cạn kiệt bộ nhớ (OOM).

---

### 3.6. Các Node Logic & Phân nhánh: IF, Switch, Edit Fields

| Node | Mã Catalog | Vai trò & Đặc điểm |
|---|---|---|
| **IF** | `logic.if` | Phân nhánh nhị phân thành 2 cổng ra `true` và `false`. Hỗ trợ 12 toán tử (`equals`, `contains`, `regex`, `gt`, `lt`, `is_empty`...). Hỗ trợ kết hợp điều kiện `AND`/`OR`. Đặc biệt có tính năng `ignore_accents` giúp xử lý ngôn ngữ tiếng Việt chính xác (ví dụ coi *"báo giá"* và *"bao gia"* là trùng khớp). |
| **Switch** | `logic.switch` | Phân nhánh đa cổng (Multi-way branching). Người dùng tự tạo các quy tắc (Rules) với nhãn cổng tùy chọn, kèm theo cổng mặc định `fallback`. Chế độ đánh giá `first` (rẽ vào cổng đầu tiên khớp) hoặc `all` (phát item tới mọi cổng khớp). Giữ nguyên kết nối của các cổng khi xóa/sắp xếp lại các quy tắc khác. |
| **Edit Fields** | `data.set` | Chỉnh sửa, thêm mới hoặc ghi đè các trường dữ liệu trên từng item. Cho phép gõ đường dẫn lồng nhau (`customer.address.city`), sử dụng biểu thức động `{{...}}`. Tùy chọn `keep_other_fields: false` giúp tinh lọc payload gọn gàng trước khi gửi qua API ngoài. |
| **Filter** | `logic.filter` | Lọc dữ liệu tuyến tính (giữ lại các bản ghi thỏa mãn điều kiện và loại bỏ các bản ghi không thỏa mãn). |
| **Aggregate** | `data.aggregate` | Gom toàn bộ danh sách items đơn lẻ thành một item duy nhất chứa mảng `items`, phục vụ các tác vụ gửi báo cáo tổng hợp. |

---

### 3.7. Thiết kế lại Canvas Frontend (UX/UI Redesign)

Giao diện Designer được hiện đại hóa theo chuẩn thẩm mỹ chuyên nghiệp:
- **Thẻ node chuẩn hóa (`BaseNode`):** Mỗi node hiển thị icon đặc trưng, khung màu phân loại, nhãn thể loại phụ (`Kind subtitle`), trạng thái hover tinh tế.
- **Cổng kết nối có nhãn (`Labeled Handles`):** Các node có nhiều output (IF, Switch) hiển thị riêng biệt từng cổng ra kèm tên rõ ràng (`True`, `False`, tên quy tắc của Switch). Các đường nối (Edges) hiển thị nhãn cổng tương ứng.
- **Đường nối mượt mà:** Chuyển sang dạng `smoothstep` kèm mũi tên định hướng luồng chảy dữ liệu.
- **Nền lưới Canvas:** Áp dụng phong cách lưới chấm (`dotted background`) kết hợp Minimap đa sắc giúp định vị workflow lớn dễ dàng.
- **Công tắc kích hoạt quy trình (`ActiveToggle`):** Cho phép bật/tắt trạng thái lắng nghe sự kiện của quy trình trực tiếp trên Header.
- **Hộp thoại tài khoản OAuth2 (`AddCredentialDialog`):** Giao diện liên kết tài khoản Facebook Meta và các nhà cung cấp bên ngoài với luồng Pop-up OAuth2 tự động.
- **Trường hiển thị URL Webhook (`WebhookUrlField`):** Hiển thị trực quan URL webhook kèm nút sao chép nhanh và hướng dẫn cấu hình ngay trong bảng thuộc tính (`PropertiesPanel`).

---

## 4. Kiểm thử và kết quả nghiệm thu

### 4.1. Thống kê bộ kiểm thử tự động

Trong tuần 08, chất lượng mã nguồn tiếp tục được củng cố với sự tăng trưởng vượt bậc về số lượng ca kiểm thử tự động trên cả hai tầng:

| Phân hệ | Loại kiểm thử | Công cụ | Số test cases | Tăng so với T07 | Trạng thái |
|---|---|---|:---:|:---:|:---:|
| **Monolith Backend** | Unit Tests (Engine, Graph, Executors, Triggers, SSRF) | Jest | **489 passed** / 489 total (29 suites) | **+276 tests** | **100% PASS** |
| **Monolith Backend** | E2E Tests (Branching, BullMQ, Messenger, Webhook, LLM) | Jest + Supertest | **11 suites** | **+5 suites** | **100% PASS** |
| **Frontend Designer** | Unit & Component Tests (BaseNode, ListField, Dialogs) | Vitest + RTL + jsdom | **29 passed** / 29 total (10 suites) | **+22 tests** | **100% PASS** |
| **Toàn hệ thống** | **Tổng số ca kiểm thử tự động** | | **518+ passed** | **+298 tests** | **100% PASS** |

- **Backend Unit Tests:** Tăng từ 213 lên **489 tests** (+129%), bao phủ toàn bộ các module mới: `apps/http-package.spec.ts`, `apps/messenger-chatbot.spec.ts`, `apps/safe-request.spec.ts`, `execution/graph-plan.spec.ts`, `execution/branching-execution.spec.ts`, `execution/chat-memory.spec.ts`, `triggers/activation.spec.ts`...
- **Frontend Vitest Tests:** Tăng từ 7 lên **29 tests** (+314%), kiểm thử toàn diện `ListField`, `AddCredentialDialog`, `ActiveToggle`, `WebhookUrlField`, `BaseNode`, `node-outputs`...

### 4.2. Kiểm tra chất lượng mã nguồn (Lint & Type Check)

- **Backend:** 
  - `npm run lint` chạy qua ESLint trên toàn bộ thư mục `src`, `apps`, `libs`, `test`: **0 errors, 0 warnings**.
  - `npx tsc --noEmit` kiểm tra kiểu dữ liệu TypeScript: **0 errors**.
- **Frontend:**
  - `npm run lint`: **0 errors**.
  - `npx tsc -b`: **0 errors**, biên dịch hoàn hảo.

### 4.3. Kết quả kịch bản nghiệm thu thực tế

1. **Kịch bản Chatbot AI tư vấn tự động trên Facebook Messenger:**
   - Kết nối Fanpage Facebook qua OAuth2 $\to$ Thiết kế luồng: `Messenger Trigger` $\to$ `Chat Memory (load)` $\to$ `LLM (OpenAI gpt-4o-mini)` $\to$ `Messenger Send Message (Quick Replies)` $\to$ `Chat Memory (save)`.
   - Kết quả: Khi khách nhắn *"Shop có bán bàn phím cơ không?"*, bot tự động hiển thị trạng thái đang gõ (`typing_on`), gọi LLM trả lời kèm 3 nút Quick Reply gợi ý (*"Xem giá"*, *"Bảo hành"*, *"Gặp nhân viên"*). Khi khách hỏi tiếp *"Cái đó giá bao nhiêu?"*, bot tự nhớ danh từ *"cái đó"* là bàn phím cơ ở câu trước và trả lời chính xác giá.
2. **Kịch bản Tiếp nhận Webhook đơn hàng & Phân nhánh Switch:**
   - Thiết kế luồng: `Webhook Trigger` $\to$ `Switch (Rule 1: status = 'VIP', Rule 2: total > 1.000.000, Fallback)` $\to$ Rẽ nhánh gửi email ưu tiên hoặc gọi API hệ thống vận chuyển qua `HTTP Request`.
   - Kết quả: Gửi POST request kèm `Idempotency-Key` $\to$ Webhook phản hồi 202 ngay lập tức; BullMQ xử lý ngầm trong 150ms; các node thuộc nhánh không thỏa mãn hiển thị nhãn `SKIPPED`, nhánh thỏa mãn thực thi thành công 100%.
3. **Kịch bản Bảo mật SSRF Guard với Node HTTP Request:**
   - Cấu hình node `HTTP Request` gọi tới các địa chỉ cấm: `http://localhost:3000`, `http://192.168.1.1/admin`, `http://169.254.169.254/latest/meta-data/`.
   - Kết quả: Toàn bộ các yêu cầu bị chặn đứng ngay tại tầng phân giải DNS với thông báo lỗi bảo mật rõ ràng, bảo vệ tuyệt đối hệ thống nội bộ.

---

## 5. Hạn chế và việc chưa làm

1. **Bộ kiểm thử E2E tích hợp đầy đủ yêu cầu dịch vụ bên ngoài:**
   - Các bài test E2E cho Messenger và OAuth2 hiện tại sử dụng mock adapter (`fake-meta-graph.ts`) để chạy ổn định trong CI/CD. Cần duy trì môi trường sandbox với Meta Developer App thực tế để kiểm tra định kỳ trước các đợt phát hành lớn.
2. **Giao diện cấu hình biểu thức trực quan:**
   - Người dùng hiện tại vẫn cần gõ biểu thức `{{$json.field}}` hoặc `{{$node["..."].json}}` thủ công vào ô nhập liệu; chưa có bảng chọn cây dữ liệu (Data tree picker / Schema autocompletion popup) để bấm chọn trực quan trên canvas.
3. **Quản lý biến môi trường toàn cục (Global Environment Variables):**
   - Biểu thức hiện hỗ trợ truy cập context của node và item; chưa hỗ trợ truy cập biến môi trường do người dùng tự định nghĩa ở cấp độ không gian làm việc (`$env.VAR_NAME`).

---

## 6. Kế hoạch tuần tới (Tuần 09)

1. **Xây dựng Data Tree Explorer & Autocompletion cho Expression:**
   - Thiết kế giao diện popover hiển thị cấu trúc dữ liệu JSON đầu ra của các node phía trước, cho phép người dùng nhấp đúp để tự động chèn biểu thức `{{$node[...].json...}}` mà không cần nhớ cú pháp.
2. **Bổ sung Node tích hợp Zalo Official Account (Zalo OA):**
   - Mở rộng hệ sinh thái Chatbot với kênh Zalo OA (nền tảng nhắn tin phổ biến nhất tại Việt Nam), áp dụng kiến trúc Package đã thiết lập ở Tuần 08.
3. **Theo dõi trạng thái thực thi thời gian thực trên Canvas (Live Execution Highlighting):**
   - Tích hợp WebSocket / SSE để khi quy trình chạy ngầm, giao diện Canvas tự động viền sáng các node đang chạy, hiển thị tick xanh hoàn thành hoặc cảnh báo lỗi tức thì.
4. **Tối ưu hóa hiệu năng hàng đợi BullMQ:**
   - Cấu hình cơ chế Rate Limiting, Retry backoff thông minh và bảng điều khiển giám sát hàng đợi (Bull-Board) cho quản trị viên.
