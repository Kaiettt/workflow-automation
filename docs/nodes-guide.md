# HƯỚNG DẪN SỬ DỤNG TẤT CẢ CÁC NODE TRONG CRABFLOWPILOT

Tài liệu này cung cấp hướng dẫn chi tiết, đầy đủ và trực quan về toàn bộ các **Node** (khối chức năng) hiện có trong nền tảng tự động hóa quy trình **CrabFlowPilot**.

---

## MỤC LỤC

1. [Tổng quan về Hệ thống Node & Luồng Dữ liệu](#1-tổng-quan-về-hệ-thống-node--luồng-dữ-liệu)
2. [Cú pháp Biểu thức Động (Expression Engine)](#2-cú-pháp-biểu-thức-động-expression-engine)
3. [Nhóm Node Kích hoạt (Trigger Nodes)](#3-nhóm-node-kích-hoạt-trigger-nodes)
   - [3.1. Manual Trigger](#31-manual-trigger)
   - [3.2. Webhook](#32-webhook)
   - [3.3. Messenger Trigger](#33-messenger-trigger)
4. [Nhóm Node Điều hướng & Logic (Logic Nodes)](#4-nhóm-node-điều-hướng--logic-logic-nodes)
   - [4.1. IF (Rẽ 2 nhánh True/False)](#41-if-rẽ-2-nhánh-truefalse)
   - [4.2. Switch (Phân nhánh đa cổng)](#42-switch-phân-nhánh-đa-cổng)
   - [4.3. Filter (Lọc dữ liệu tuyến tính)](#43-filter-lọc-dữ-liệu-tuyến-tính)
5. [Nhóm Node Xử lý Dữ liệu & Bộ nhớ (Data Processing & Memory)](#5-nhóm-node-xử-lý-dữ-liệu--bộ-nhớ-data-processing--memory)
   - [5.1. Edit Fields (Gán & Đổi trường dữ liệu)](#51-edit-fields-gán--đổi-trường-dữ-liệu)
   - [5.2. Aggregate (Gom mảng dữ liệu)](#52-aggregate-gom-mảng-dữ-liệu)
   - [5.3. Chat Memory (Bộ nhớ hội thoại đa lượt)](#53-chat-memory-bộ-nhớ-hội-thoại-đa-lượt)
6. [Nhóm Node Trí tuệ Nhân tạo (AI Nodes)](#6-nhóm-node-trí-tuệ-nhân-tạo-ai-nodes)
   - [6.1. LLM (OpenAI, Anthropic Claude, Google Gemini)](#61-llm-openai-anthropic-claude-google-gemini)
7. [Nhóm Node Tích hợp Bên ngoài (Integration Nodes)](#7-nhóm-node-tích-hợp-bên-ngoài-integration-nodes)
   - [7.1. HTTP Request (Gọi Web API & Bảo vệ SSRF)](#71-http-request-gọi-web-api--bảo-vệ-ssrf)
   - [7.2. Read Google Sheet Rows](#72-read-google-sheet-rows)
   - [7.3. Send Gmail](#73-send-gmail)
   - [7.4. Messenger Send Message](#74-messenger-send-message)
   - [7.5. Messenger Sender Action](#75-messenger-sender-action)
8. [Các Kịch bản Thực tế Tiêu biểu (Workflow Recipes)](#8-các-kịch-bản-thực-tế-tiêu-biểu-workflow-recipes)
9. [Bảng Tra cứu Nhanh Mã Catalog & Thuộc tính](#9-bảng-tra-cứu-nhanh-mã-catalog--thuộc-tính)

---

## 1. Tổng quan về Hệ thống Node & Luồng Dữ liệu

### 1.1. Mô hình Đồ thị Thực thi (DAG Execution)
CrabFlowPilot vận hành theo mô hình **Đồ thị có hướng không chu trình (Directed Acyclic Graph - DAG)**:
- **Dữ liệu truyền theo dạng Items Stream:** Mỗi node nhận vào một mảng các bản ghi (`items: Array<{ json: Record<string, unknown> }>`) và phát ra một mảng các bản ghi cho node kế tiếp.
- **Thực thi phân nhánh (Named Outputs):** Các node như `IF` hay `Switch` sở hữu nhiều cổng ra độc lập. Một cạnh kết nối chỉ được kích hoạt (`active`) khi node nguồn phát dữ liệu vào cổng tương ứng. Các node thuộc nhánh không được chọn sẽ tự động chuyển sang trạng thái `SKIPPED`.
- **Thực thi đồng bộ & bất đồng bộ (Queue Worker):**
  - Kích hoạt thủ công: Thực thi đồng bộ và trả kết quả tức thì.
  - Kích hoạt qua Webhook / Messenger: Hệ thống trả mã `202 Accepted` ngay lập tức và đẩy tiến trình thực thi vào hàng đợi **BullMQ (Redis)** để chạy ngầm an toàn và đáng tin cậy.

---

## 2. Cú pháp Biểu thức Động (Expression Engine)

Tại bất kỳ trường nào có biểu tượng biểu thức hoặc ghi chú cho phép nhập biểu thức, bạn có thể sử dụng cú pháp dấu ngoặc nhọn kép `{{ ... }}` để nhúng dữ liệu động.

### 2.1. Các mẫu biểu thức phổ biến

| Cú pháp | Ý nghĩa & Ứng dụng |
|---|---|
| `{{$json.fieldName}}` | Đọc trường `fieldName` từ bản ghi của node ngay phía trước. |
| `{{$json["full name"]}}` | Đọc trường có chứa khoảng trắng hoặc ký tự đặc biệt. |
| `{{$json.customer.address.city}}` | Đọc đường dẫn đối tượng lồng nhau (nested properties). |
| `{{$json.items[0].id}}` | Đọc phần tử theo chỉ mục trong mảng. |
| `{{$node["Tên Node"].json.fieldName}}` | Đọc trường dữ liệu từ một node bất kỳ ở phía trước trong đồ thị (sử dụng chính xác Tên hiển thị của node trên canvas). |
| `{{$node["Tên Node"].all}}` | Lấy toàn bộ mảng các item đầu ra từ node được chỉ định. |

> [!TIP]
> **Tính năng Gợi ý Tên Node Thông minh (Smart Suggestions):** Nếu bạn gõ sai chữ hoa/thường hoặc thừa khoảng trắng (ví dụ `{{$node["messenger trigger"].json.sender_id}}`), hệ thống sẽ tự động phát hiện và gợi ý tên đúng: *"Did you mean 'Messenger Trigger'?"*.

---

## 3. Nhóm Node Kích hoạt (Trigger Nodes)

Node Trigger là điểm xuất phát bắt buộc của mọi quy trình. Một workflow hợp lệ phải có đúng **1 Trigger node**.

---

### 3.1. Manual Trigger
- **Mã Catalog:** `trigger.manual`
- **Icon:** `play` | **Màu:** Xám `#6B7280`
- **Cổng ra:** 1 cổng mặc định
- **Yêu cầu Tài khoản (Credential):** Không

#### Mục đích sử dụng
Dùng khi bạn muốn chủ động chạy quy trình bằng cách bấm nút **"Run Workflow"** trên thanh công cụ Designer hoặc gọi API kích hoạt thủ công khi kiểm thử.

#### Dữ liệu đầu ra (Output Schema)
Tạo ra một item rỗng khởi đầu luồng dữ liệu:
```json
{
  "json": {}
}
```

---

### 3.2. Webhook
- **Mã Catalog:** `webhook.trigger`
- **Icon:** `webhook` | **Màu:** Tím chàm `#6366F1`
- **Cổng ra:** 1 cổng mặc định
- **Yêu cầu Tài khoản (Credential):** Không (Mỗi node có một bí mật URL riêng)

#### Mục đích sử dụng
Cho phép bất kỳ hệ thống nào từ bên ngoài (như CRM, website bán hàng, cổng thanh toán Stripe/Momo, GitHub...) kích hoạt quy trình bằng cách gửi một yêu cầu HTTP POST tới URL của node.

#### Cách lấy URL Webhook
1. Nhấp vào node **Webhook** trên Canvas.
2. Tại bảng **Properties Panel** bên phải, sao chép đường link hiển thị tại ô **Webhook URL** (dạng: `https://your-domain.com/api/webhooks/w/<secret-token>`).
3. Xuất bản (Publish) và bật công tắc **Active** của workflow.

#### Dữ liệu đầu ra (Output Schema)
```json
{
  "json": {
    "body": {
      "order_id": "ORD-12345",
      "customer_email": "khachhang@example.com",
      "total_amount": 750000
    },
    "query": {},
    "headers": {
      "content-type": "application/json",
      "user-agent": "PostmanRuntime/7.36.0"
    },
    "received_at": "2026-11-01T10:15:30.000Z"
  }
}
```

#### Xử lý chống trùng lặp (Idempotency)
Bên gửi có thể truyền thêm tiêu đề HTTP Header `Idempotency-Key: <unique-request-id>`. Hệ thống sẽ lưu vết trên Redis và đảm bảo chỉ thực thi quy trình một lần duy nhất cho mỗi mã yêu cầu.

---

### 3.3. Messenger Trigger
- **Mã Catalog:** `messenger.trigger`
- **Icon:** `message-circle` | **Màu:** Xanh Messenger `#0084FF`
- **Cổng ra:** 1 cổng mặc định
- **Yêu cầu Tài khoản (Credential):** Facebook Messenger Account (OAuth2)

#### Mục đích sử dụng
Tự động kích hoạt quy trình mỗi khi có khách hàng gửi tin nhắn văn bản hoặc bấm nút tương tác trên Fanpage Facebook của bạn.

#### Các trường cấu hình (Properties)
- **Credential:** Chọn tài khoản Meta App đã kết nối.
- **Page:** Chọn Fanpage mà bạn muốn lắng nghe tin nhắn.
- **Events:**
  - `all`: Lắng nghe cả tin nhắn văn bản và sự kiện nhấn nút.
  - `message`: Chỉ kích hoạt khi khách nhắn tin văn bản.
  - `postback`: Chỉ kích hoạt khi khách bấm nút (Postback button hoặc Quick Reply).
- **Keywords (Tùy chọn):** Danh sách từ khóa lọc kích hoạt (ví dụ: `giá, tư vấn, mua hàng`). Nếu nhập, bot chỉ chạy khi tin nhắn chứa ít nhất một từ khóa (hệ thống tự động bỏ qua hoa thường và dấu tiếng Việt).

#### Dữ liệu đầu ra (Output Schema)
```json
{
  "json": {
    "sender_id": "8492019481029481",
    "page_id": "100294819201948",
    "event": "message",
    "message_id": "mid.1792837192:a928c1b",
    "text": "Shop ơi cho mình hỏi giá sản phẩm này với",
    "payload": null,
    "timestamp": 1792837192000
  }
}
```

---

## 4. Nhóm Node Điều hướng & Logic (Logic Nodes)

Nhóm node này quyết định hướng đi của dòng dữ liệu trong đồ thị.

---

### 4.1. IF (Rẽ 2 nhánh True/False)
- **Mã Catalog:** `logic.if`
- **Icon:** `git-branch` | **Màu:** Tím `#8B5CF6`
- **Cổng ra:** **2 cổng riêng biệt:**
  - `True`: Dành cho các bản ghi thỏa mãn điều kiện.
  - `False`: Dành cho các bản ghi không thỏa mãn.

#### Các trường cấu hình
1. **Conditions (Danh sách điều kiện):**
   - **Value 1:** Biểu thức cần kiểm tra (ví dụ: `{{$json.text}}` hoặc `{{$json.total}}`).
   - **Operator:** Chọn 1 trong 12 toán tử:
     - Văn bản: `equals`, `not_equals`, `contains`, `not_contains`, `starts_with`, `ends_with`, `regex`.
     - Rỗng: `is_empty`, `is_not_empty`.
     - Số: `gt` (lớn hơn), `lt` (nhỏ hơn).
   - **Compare to (Value 2):** Giá trị so sánh (ẩn khi chọn toán tử `is_empty`/`is_not_empty`).
2. **Combine conditions:**
   - `All must match (AND)`: Tất cả điều kiện phải đúng.
   - `Any can match (OR)`: Chỉ cần một điều kiện đúng.
3. **Ignore case (Mặc định: Bật):** Không phân biệt chữ hoa, chữ thường.
4. **Ignore accents (Mặc định: Bật):** Bỏ qua dấu tiếng Việt (ví dụ coi `"báo giá"` và `"bao gia"` là như nhau).

---

### 4.2. Switch (Phân nhánh đa cổng)
- **Mã Catalog:** `logic.switch`
- **Icon:** `split` | **Màu:** Tím `#8B5CF6`
- **Cổng ra:** Đa cổng (Tùy biến theo từng quy tắc) + Cổng mặc định `fallback`.

#### Mục đích sử dụng
Phân loại luồng xử lý theo nhiều kịch bản (ví dụ: Phân loại ý định khách hàng thành *Hỏi giá*, *Khiếu nại*, *Hỗ trợ kỹ thuật*, và các câu hỏi thông thường).

#### Các trường cấu hình
1. **Rules (Danh sách quy tắc):**
   - **Output name (Label):** Tên cổng ra hiển thị trên Canvas (ví dụ: `Hỏi giá`). Cổng này sẽ xuất hiện thành một handle độc lập trên node.
   - **Conditions:** Bộ điều kiện tương tự node IF.
   - **Combine:** AND hoặc OR.
2. **Which rules (Chế độ duyệt):**
   - `First match only`: Bản ghi chỉ rẽ vào nhánh đầu tiên thỏa mãn điều kiện.
   - `Every matching rule`: Bản ghi được nhân bản và rẽ vào tất cả các nhánh thỏa mãn.
3. **Fallback Output:** Các bản ghi không thỏa mãn bất kỳ quy tắc nào sẽ tự động đi vào cổng `fallback`.

---

### 4.3. Filter (Lọc dữ liệu tuyến tính)
- **Mã Catalog:** `logic.filter`
- **Icon:** `filter` | **Màu:** Tím `#8B5CF6`
- **Cổng ra:** 1 cổng mặc định

#### Mục đích sử dụng
Lọc dòng dữ liệu trên một đường thẳng duy nhất. Các item thỏa mãn điều kiện sẽ đi tiếp; các item không thỏa mãn sẽ bị loại bỏ hoàn toàn khỏi luồng thực thi.

---

## 5. Nhóm Node Xử lý Dữ liệu & Bộ nhớ (Data Processing & Memory)

---

### 5.1. Edit Fields (Gán & Đổi trường dữ liệu)
- **Mã Catalog:** `data.set`
- **Icon:** `pencil` | **Màu:** Vàng cam `#F59E0B`
- **Cổng ra:** 1 cổng mặc định

#### Mục đích sử dụng
Tạo mới trường, đổi tên trường, tính toán giá trị biểu thức, hoặc làm sạch dữ liệu trước khi gửi sang hệ thống tiếp theo.

#### Các trường cấu hình
1. **Fields (Danh sách trường):**
   - **Name:** Tên trường muốn gán. Hỗ trợ đường dẫn lồng nhau: ví dụ gõ `order.customer_name` sẽ tự động tạo đối tượng `{ order: { customer_name: ... } }`.
   - **Value:** Giá trị cần gán (hỗ trợ biểu thức động, ví dụ: `{{$json.first_name}} {{$json.last_name}}`).
2. **Keep the other fields:**
   - `True` (Mặc định): Giữ nguyên các trường cũ khác trong item.
   - `False`: Xóa sạch tất cả trường cũ, chỉ giữ lại các trường vừa định nghĩa trong danh sách Fields (rất tiện để tinh gọn payload gửi đi).

---

### 5.2. Aggregate (Gom mảng dữ liệu)
- **Mã Catalog:** `data.aggregate`
- **Icon:** `layers` | **Màu:** Vàng cam `#F59E0B`
- **Cổng ra:** 1 cổng mặc định

#### Mục đích sử dụng
Khi một node phía trước trả về nhiều item độc lập (ví dụ đọc 100 dòng từ Google Sheets), node Aggregate sẽ gom toàn bộ 100 item đó thành **1 item duy nhất** chứa mảng tổng hợp. Thích hợp chuẩn bị dữ liệu tạo bảng thống kê hoặc gửi một email báo cáo tổng quan.

#### Cấu hình
- **Field Name:** Tên trường mảng kết quả (mặc định là `items`).

---

### 5.3. Chat Memory (Bộ nhớ hội thoại đa lượt)
- **Mã Catalog:** `memory.chat`
- **Icon:** `brain` | **Màu:** Xanh Teal `#14B8A6`
- **Cổng ra:** 1 cổng mặc định
- **Lưu trữ:** Vận hành trên Redis

#### Mục đích sử dụng
Lưu trữ và duy trì ngữ cảnh trò chuyện giữa khách hàng và Chatbot AI. Giúp AI ghi nhớ câu hỏi trước đó của khách để trả lời tự nhiên, liền mạch.

#### Ba chế độ hoạt động (Action Mode)
1. **`Load the conversation` (Nạp lịch sử):**
   - Đặt ở **trước** node LLM.
   - Truy vấn lịch sử chat của người dùng dựa trên `Session key` (ví dụ `{{$json.sender_id}}`).
   - Bổ sung 2 trường vào item:
     - `history`: Mảng danh sách các lượt chat dạng `[{ role: "user", content: "..." }, { role: "assistant", content: "..." }]`. Trường này dùng để gắn trực tiếp vào ô `history` của node **LLM**.
     - `history_text`: Chuỗi văn bản nối các lượt thoại phục vụ hiển thị nhanh.
   - **Turns to load (`window`):** Số lượt hỏi-đáp tối đa cần nạp (mặc định: 10 lượt).
2. **`Save a turn` (Lưu lượt mới):**
   - Đặt ở **sau** khi đã có câu trả lời từ LLM hoặc sau khi gửi tin nhắn.
   - **Customer message:** Câu hỏi của khách (ví dụ `{{$node["Messenger Trigger"].json.text}}`).
   - **Bot reply:** Câu trả lời của bot (ví dụ `{{$node["LLM"].json.text}}`).
   - **Forget after (days) (`ttl_days`):** Thời hạn tự động xóa bộ nhớ sau số ngày không hoạt động (mặc định: 7 ngày).
3. **`Forget the conversation` (Xóa bộ nhớ):**
   - Xóa toàn bộ lịch sử khi khách kết thúc phiên hỗ trợ hoặc bấm nút "Bắt đầu lại".

---

## 6. Nhóm Node Trí tuệ Nhân tạo (AI Nodes)

---

### 6.1. LLM (OpenAI, Anthropic Claude, Google Gemini)
- **Mã Catalog:** `ai.llm.generate`
- **Icon:** `sparkles` | **Màu:** Xanh da trời `#0EA5E9`
- **Cổng ra:** 1 cổng mặc định

#### Mục đích sử dụng
Gửi yêu cầu tới các mô hình ngôn ngữ lớn hàng đầu thế giới để tạo câu trả lời, phân tích cảm xúc, tóm tắt nội dung, hoặc bóc tách dữ liệu theo định dạng JSON.

#### Các trường cấu hình
1. **Provider:** Chọn nhà cung cấp:
   - `openai`: Sử dụng các mô hình OpenAI (GPT-4o, GPT-4o-mini, GPT-4-turbo...).
   - `anthropic`: Sử dụng các mô hình Claude (claude-3-5-sonnet, claude-3-haiku, claude-3-opus...).
   - `gemini`: Sử dụng các mô hình Google (gemini-2.0-flash, gemini-1.5-pro...).
2. **Credential:** Chọn khóa API Key tương ứng với nhà cung cấp đã chọn.
3. **Model:** Nhập tên mô hình (ví dụ: `gpt-4o-mini`, `claude-3-5-sonnet-20241022`, `gemini-2.0-flash`).
4. **System prompt:** Chỉ dẫn nhân cách hoặc nghiệp vụ cho AI (ví dụ: *"Bạn là nhân viên tư vấn bán hàng của CrabStore, luôn chào hỏi thân thiện và báo giá chính xác"*).
5. **Conversation history:** Nhập `{{$json.history}}` từ node **Chat Memory** để kích hoạt trí nhớ hội thoại.
6. **Prompt:** Câu hỏi hoặc nội dung cần AI xử lý (ví dụ: `{{$json.text}}`).
7. **Output format:**
   - `text`: Trả về văn bản thông thường.
   - `json`: Ép buộc mô hình trả về đối tượng JSON hợp lệ (rất hữu ích khi cần bóc tách dữ liệu có cấu trúc).
8. **Temperature:** Độ sáng tạo (từ `0.0` đến `1.0`, khuyên dùng `0.3` cho tư vấn thông tin và `0.7` cho sáng tạo nội dung).
9. **Max tokens:** Giới hạn độ dài câu trả lời (mặc định: 1024 tokens).

#### Dữ liệu đầu ra (Output Schema)
```json
{
  "json": {
    "text": "Dạ chào bạn! Hiện tại mẫu bàn phím cơ bên mình đang có giá khuyến mãi là 850.000 VNĐ kèm bảo hành 12 tháng ạ.",
    "model": "gpt-4o-mini",
    "usage": {
      "prompt_tokens": 128,
      "completion_tokens": 42,
      "total_tokens": 170
    }
  }
}
```

---

## 7. Nhóm Node Tích hợp Bên ngoài (Integration Nodes)

---

### 7.1. HTTP Request (Gọi Web API & Bảo vệ SSRF)
- **Mã Catalog:** `http.request`
- **Icon:** `globe` | **Màu:** Xám Slate `#475569`
- **Cổng ra:** 1 cổng mặc định

#### Mục đích sử dụng
Giao tiếp với mọi dịch vụ web, hệ thống ERP nội bộ, nền tảng SaaS hoặc bất kỳ API REST nào qua HTTP.

#### Các trường cấu hình
1. **Method:** `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`.
2. **URL:** Đường dẫn endpoint API (hỗ trợ biểu thức, ví dụ: `https://api.crm.com/v1/customers/{{$json.customer_id}}`).
3. **Authentication:**
   - `None`: Không cần chứng thực.
   - `Header (API key)`: Tự động đính kèm khóa bí mật vào HTTP Header.
   - `Bearer token`: Đính kèm `Authorization: Bearer <token>`.
   - `Basic auth`: Tự động mã hóa Base64 `username:password`.
4. **Query parameters:** Bảng cặp khóa - giá trị thêm vào query string (ví dụ: `page = 1`, `limit = 50`).
5. **Headers:** Tùy biến các header gửi kèm.
6. **Body:** Chọn kiểu dữ liệu `json`, `form-urlencoded`, hoặc `text` và nhập nội dung.

> [!IMPORTANT]
> **Cơ chế Bảo vệ An ninh SSRF Guard:**
> Node HTTP Request được tích hợp sẵn lớp phòng vệ nghiêm ngặt chống tấn công Server-Side Request Forgery:
> - Tự động chặn mọi cuộc gọi tới địa chỉ IP nội bộ / private IP (`127.0.0.1`, `10.x.x.x`, `192.168.x.x`, `172.16.x.x`, `169.254.169.254`).
> - Ghim địa chỉ IP đã phân giải (Connection Pinning) chống tấn công DNS Rebinding.
> - Giới hạn kích thước phản hồi tối đa 5MB.
> - *(Dành cho Developer)*: Đặt biến môi trường `HTTP_REQUEST_ALLOW_PRIVATE=true` trong `.env` nếu cần gọi tới các service local trong quá trình phát triển.

---

### 7.2. Read Google Sheet Rows
- **Mã Catalog:** `integration.google_sheet.readRows`
- **Icon:** Logo Google Sheets | **Màu:** Xanh lá `#34A853`
- **Cổng ra:** 1 cổng mặc định
- **Yêu cầu Tài khoản:** Google Account (OAuth2)

#### Mục đích sử dụng
Đọc dữ liệu bảng tính từ Google Sheets. Mỗi dòng trong bảng tính sẽ trở thành một item riêng biệt trong luồng dữ liệu của workflow.

#### Các trường cấu hình
- **Credential:** Chọn tài khoản Google đã liên kết.
- **Spreadsheet ID:** Chuỗi mã định danh bảng tính (lấy từ link URL của Google Sheet nằm giữa `/d/` và `/edit`).
- **Sheet Name:** Tên trang tính (tab) cần đọc (ví dụ: `Sheet1` hoặc `Khách Hàng`).

---

### 7.3. Send Gmail
- **Mã Catalog:** `integration.gmail.send`
- **Icon:** Logo Gmail | **Màu:** Đỏ `#EA4335`
- **Cổng ra:** 1 cổng mặc định
- **Yêu cầu Tài khoản:** Google Account (OAuth2)

#### Mục đích sử dụng
Gửi thư điện tử tự động thông qua tài khoản Gmail cá nhân hoặc Google Workspace.

#### Các trường cấu hình
- **Credential:** Chọn tài khoản Google có quyền gửi mail.
- **Recipient (To):** Địa chỉ email người nhận (hỗ trợ biểu thức, ví dụ: `{{$json.email}}`).
- **Subject:** Tiêu đề thư (ví dụ: `[Xác nhận] Đơn hàng #{{$json.order_id}} đã được tạo thành công`).
- **Body:** Nội dung thư (hỗ trợ văn bản nhiều dòng và biểu thức).

---

### 7.4. Messenger Send Message
- **Mã Catalog:** `messenger.sendMessage`
- **Icon:** `send` | **Màu:** Xanh Messenger `#0084FF`
- **Cổng ra:** 1 cổng mặc định
- **Yêu cầu Tài khoản:** Facebook Messenger Account (OAuth2)

#### Mục đích sử dụng
Gửi tin nhắn phản hồi tới khách hàng trên Facebook Messenger qua Page Access Token.

#### Các trường cấu hình
1. **Page:** Chọn Fanpage gửi tin.
2. **Recipient PSID:** ID người nhận (thường lấy từ `{{$node["Messenger Trigger"].json.sender_id}}`).
3. **Message type:** Chọn 1 trong 4 loại tin nhắn:
   - **`Text`:** Tin nhắn văn bản thuần túy (nhập tại ô *Message text*).
   - **`Quick Replies`:** Tin nhắn văn bản kèm danh sách nút bấm nhanh bên dưới (tối đa 13 nút, mỗi nút gồm *Title* và *Payload*).
   - **`Buttons`:** Mẫu thẻ chứa các nút hành động (tối đa 3 nút dạng Postback hoặc Web URL).
   - **`Media`:** Gửi tệp đa phương tiện. Chọn loại media (`image`, `video`, `audio`, `file`) và dán link công khai tại ô *Media URL*.

---

### 7.5. Messenger Sender Action
- **Mã Catalog:** `messenger.senderAction`
- **Icon:** `ellipsis` | **Màu:** Xanh Messenger `#0084FF`
- **Cổng ra:** 1 cổng mặc định
- **Yêu cầu Tài khoản:** Facebook Messenger Account (OAuth2)

#### Mục đích sử dụng
Gửi trạng thái tương tác để tạo trải nghiệm tự nhiên cho khách hàng trong lúc hệ thống đang xử lý dữ liệu phức tạp.

#### Cấu hình
- **Action:**
  - `Show typing…` (`typing_on`): Hiển thị hiệu ứng ba chấm "Đang soạn tin...".
  - `Hide typing` (`typing_off`): Tắt hiệu ứng đang soạn tin.
  - `Mark as seen` (`mark_seen`): Đánh dấu tin nhắn của khách là đã đọc.

---

## 8. Các Kịch bản Thực tế Tiêu biểu (Workflow Recipes)

### Kịch bản 1: Chatbot AI Tư vấn Bán hàng Đa lượt trên Facebook Messenger

Quy trình tự động tiếp nhận tin nhắn khách hàng trên Fanpage, hiển thị trạng thái đang soạn tin, nạp lịch sử nói chuyện từ Redis, gọi AI trả lời thông minh và lưu lại câu trả lời:

```
[Messenger Trigger] 
       │
       ▼
[Messenger Sender Action (typing_on)]
       │
       ▼
[Chat Memory (mode: load, session_key: {{$json.sender_id}})]
       │
       ▼
[LLM (OpenAI gpt-4o-mini, history: {{$json.history}})]
       │
       ▼
[Messenger Send Message (Quick Replies: "Báo giá", "Bảo hành")]
       │
       ▼
[Chat Memory (mode: save, user: {{$node["Messenger Trigger"].json.text}}, bot: {{$node["LLM"].json.text}})]
```

---

### Kịch bản 2: Tiếp nhận Webhook Đơn hàng, Phân loại Switch & Gửi Mail

Quy trình tiếp nhận đơn hàng từ website, phân loại khách VIP hay khách thường để xử lý tương ứng:

```
                  [Webhook Trigger]
                          │
                          ▼
             [Switch: Phân loại đơn hàng]
             /                          \
   [Rule 1: total > 2 triệu]        [Fallback: Đơn thường]
            │                                   │
            ▼                                   ▼
 [Send Gmail: Báo quản lý]         [HTTP Request: Cập nhật CRM]
```

---

### Kịch bản 3: Đọc Google Sheets, Tổng hợp Dữ liệu & AI Phân tích Báo cáo

```
[Manual Trigger]
       │
       ▼
[Read Google Sheet Rows (Đọc 50 dòng doanh thu tuần)]
       │
       ▼
[Aggregate (Gom toàn bộ 50 dòng thành mảng items)]
       │
       ▼
[LLM (Tóm tắt doanh thu nổi bật và phát hiện bất thường)]
       │
       ▼
[Send Gmail (Gửi báo cáo phân tích cho Giám đốc)]
```

---

## 9. Bảng Tra cứu Nhanh Mã Catalog & Thuộc tính

| Tên Hiển thị (Display Name) | Mã Catalog (`key`) | Phân nhóm (`category`) | Cổng ra (Outputs) | Tài khoản (Credential) |
|---|---|---|:---:|:---:|
| **Manual Trigger** | `trigger.manual` | `TRIGGER` | 1 (Mặc định) | Không |
| **Webhook** | `webhook.trigger` | `TRIGGER` | 1 (Mặc định) | Không (Dùng Token URL) |
| **Messenger Trigger** | `messenger.trigger` | `TRIGGER` | 1 (Mặc định) | `facebookMessengerOAuth2` |
| **IF** | `logic.if` | `LOGIC` | 2 (`true`, `false`) | Không |
| **Switch** | `logic.switch` | `LOGIC` | Đa cổng + `fallback` | Không |
| **Filter** | `logic.filter` | `LOGIC` | 1 (Mặc định) | Không |
| **Edit Fields** | `data.set` | `DATA_PROCESSING` | 1 (Mặc định) | Không |
| **Aggregate** | `data.aggregate` | `DATA_PROCESSING` | 1 (Mặc định) | Không |
| **Chat Memory** | `memory.chat` | `DATA_PROCESSING` | 1 (Mặc định) | Không (Dùng Redis nội bộ) |
| **LLM** | `ai.llm.generate` | `AI` | 1 (Mặc định) | `openai` / `anthropic` / `gemini` |
| **HTTP Request** | `http.request` | `INTEGRATION` | 1 (Mặc định) | Tùy chọn (Header / Bearer / Basic) |
| **Read Google Sheet Rows** | `integration.google_sheet.readRows` | `INTEGRATION` | 1 (Mặc định) | `google` (OAuth2) |
| **Send Gmail** | `integration.gmail.send` | `INTEGRATION` | 1 (Mặc định) | `google` (OAuth2) |
| **Messenger Send Message** | `messenger.sendMessage` | `INTEGRATION` | 1 (Mặc định) | `facebookMessengerOAuth2` |
| **Messenger Sender Action** | `messenger.senderAction` | `INTEGRATION` | 1 (Mặc định) | `facebookMessengerOAuth2` |

---

*Tài liệu được biên soạn đồng bộ với phiên bản CrabFlowPilot Tuần 08 (Tháng 11/2026).*
