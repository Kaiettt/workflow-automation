# CẨM NANG THỰC CHIẾN CẤU HÌNH NODE & BÍ KÍP BẢO VỆ ĐỒ ÁN CRABFLOWPILOT

> **Dành cho:** Developer & Người vận hành hệ thống CrabFlowPilot.  
> **Mục tiêu:** Cung cấp hướng dẫn cầm tay chỉ việc cho từng node: từ chuẩn bị điều kiện tiên quyết, giải thích từng ô cấu hình, cho đến xem trước dữ liệu đầu ra (Output Preview) và danh sách biểu thức sẵn sàng sao chép cho node tiếp theo.

---

## MỤC LỤC TỔNG QUAN

1. [Nguyên lý Dòng Dữ liệu & Quy tắc Viết Biểu thức](#1-nguyên-lý-dòng-dữ-liệu--quy-tắc-viết-biểu-thức)
2. [NHÓM 1: CÁC NODE KÍCH HOẠT (TRIGGER NODES)](#nhóm-1-các-node-kích-hoạt-trigger-nodes)
   - [1.1. Manual Trigger](#11-manual-trigger)
   - [1.2. Webhook](#12-webhook)
   - [1.3. Messenger Trigger](#13-messenger-trigger)
3. [NHÓM 2: CÁC NODE ĐIỀU HƯỚNG & LOGIC (LOGIC NODES)](#nhóm-2-các-node-điều-hướng--logic-logic-nodes)
   - [2.1. IF (Rẽ 2 nhánh True / False)](#21-if-rẽ-2-nhánh-true--false)
   - [2.2. Switch (Rẽ đa nhánh theo quy tắc)](#22-switch-rẽ-đa-nhánh-theo-quy-tắc)
   - [2.3. Filter (Lọc dữ liệu tuyến tính)](#23-filter-lọc-dữ-liệu-tuyến-tính)
4. [NHÓM 3: CÁC NODE XỬ LÝ DỮ LIỆU & BỘ NHỚ (DATA & MEMORY)](#nhóm-3-các-node-xử-lý-dữ-liệu--bộ-nhớ-data--memory)
   - [3.1. Edit Fields (Set)](#31-edit-fields-set)
   - [3.2. Aggregate (Gom mảng dữ liệu)](#32-aggregate-gom-mảng-dữ-liệu)
   - [3.3. Chat Memory (Bộ nhớ hội thoại Redis)](#33-chat-memory-bộ-nhớ-hội-thoại-redis)
5. [NHÓM 4: NODE TRÍ TUỆ NHÂN TẠO (AI LLM)](#nhóm-4-node-trí-tuệ-nhân-tạo-ai-llm)
   - [4.1. LLM (OpenAI, Anthropic Claude, Google Gemini)](#41-llm-openai-anthropic-claude-google-gemini)
6. [NHÓM 5: CÁC NODE TÍCH HỢP NGOÀI (INTEGRATION NODES)](#nhóm-5-các-node-tích-hợp-ngoài-integration-nodes)
   - [5.1. Read Google Sheet Rows](#51-read-google-sheet-rows)
   - [5.2. Send Gmail](#52-send-gmail)
   - [5.3. Messenger Send Message](#53-messenger-send-message)
   - [5.4. Messenger Sender Action](#54-messenger-sender-action)
   - [5.5. HTTP Request (Bảo vệ SSRF Guard)](#55-http-request-bảo-vệ-ssrf-guard)
7. [BẢNG TRA CỨU BIỂU THỨC "COPY DÙNG NGAY" CHO TOÀN BỘ 15 NODE](#7-bảng-tra-cứu-biểu-thức-copy-dùng-ngay-cho-toàn-bộ-15-node)
8. [BÍ KÍP BẢO VỆ ĐỒ ÁN: 10 CÂU HỎI HỘI ĐỒNG HAY "SẤY" NHẤT](#8-bí-kíp-bảo-vệ-đồ-án-10-câu-hỏi-hội-đồng-hay-sấy-nhất)

---

## 1. Nguyên lý Dòng Dữ liệu & Quy tắc Viết Biểu thức

Trước khi cấu hình bất kỳ node nào, hãy nắm vững 2 nguyên tắc vàng sau:

### Nguyên tắc 1: Dữ liệu di chuyển theo từng Item (Item-based Stream)
- Khi một node chạy, dữ liệu nó sinh ra được bọc trong một đối tượng:
  ```json
  {
    "json": {
      "tên_trường_1": "giá trị 1",
      "tên_trường_2": 12345
    }
  }
  ```
- Node đứng ngay sau sẽ tự động nhận danh sách các item này làm đầu vào.

### Nguyên tắc 2: Hai loại Biểu thức truy xuất dữ liệu
Tại bất kỳ ô nhập liệu nào có biểu tượng **fx** (màu tím), bạn có thể dùng dấu ngoặc nhọn kép `{{ ... }}`:
1. **Lấy từ node đứng ngay trước:** Dùng cú pháp `{{$json.tên_trường}}`.
2. **Lấy từ node đứng xa ở phía trước:** Dùng cú pháp `{{$node["Tên Node Chính Xác"].json.tên_trường}}`.  
   *(Ví dụ: Node thứ 4 cần lấy ID khách từ Messenger Trigger ở đầu workflow → gõ `{{$node["Messenger Trigger"].json.sender_id}}`).*

---

## NHÓM 1: CÁC NODE KÍCH HOẠT (TRIGGER NODES)

Trigger là điểm khởi đầu bắt buộc của một workflow. Mỗi workflow hợp lệ phải có đúng 1 Trigger.

---

### 1.1. Manual Trigger
* **Mã Catalog:** `trigger.manual` | **Phân nhóm:** `TRIGGER`
* **Màu sắc / Icon:** Xám `#6B7280` | Icon `play`
* **Cổng ra:** 1 cổng mặc định

#### 1. Dùng để làm gì?
Dùng khi bạn muốn chủ động bấm nút **"Run"** trên thanh công cụ Designer để chạy thử quy trình hoặc kích hoạt quy trình định kỳ bằng tay (ví dụ: bấm nút để quét đơn hàng từ Google Sheet và gửi email báo cáo).

#### 2. Điều kiện cần trước khi dùng
- Không cần tài khoản (Credential) hay cài đặt server bên ngoài.
- Thêm vào Canvas là sử dụng được ngay.

#### 3. Hướng dẫn cấu hình từng trường
Node này không cần cấu hình thêm bất kỳ tham số nào.

#### 4. Output Preview Schema (Dữ liệu sinh ra)
Tạo ra một item khởi tạo rỗng để kích hoạt các bước tiếp theo:
```json
{
  "json": {}
}
```

#### 5. Ví dụ cắm dây thực tế
```
[Manual Trigger] ──> [Read Google Sheet Rows] ──> [Send Gmail]
```

---

### 1.2. Webhook
* **Mã Catalog:** `webhook.trigger` | **Phân nhóm:** `TRIGGER`
* **Màu sắc / Icon:** Tím chàm `#6366F1` | Icon `webhook`
* **Cổng ra:** 1 cổng mặc định

#### 1. Dùng để làm gì?
Cho phép hệ thống bên ngoài (Website bán hàng, CRM, Stripe, GitHub, Google Forms, v.v.) tự động kích hoạt workflow bằng cách gửi một HTTP POST request chứa dữ liệu tới URL riêng của node này.

#### 2. Điều kiện cần trước khi dùng
1. Server backend phải có địa chỉ Public HTTPS (khi phát triển ở local, dùng `cloudflared tunnel` hoặc `ngrok` và cấu hình biến `PUBLIC_BASE_URL` trong file `.env`).
2. Workflow phải được bấm **Publish** và gạt công tắc **Active** (màu xanh).

#### 3. Hướng dẫn cấu hình từng trường
| Tên trường trên UI | Bắt buộc | Điền gì vào đây? | Ví dụ cụ thể |
|---|:---:|---|---|
| **Webhook URL** | Tự sinh | FlowPilot tự sinh đường dẫn duy nhất cho node này dạng `/api/webhooks/<id>`. Bấm nút Copy để dán vào cài đặt Webhook của bên thứ ba. | `https://flow.example.com/api/webhooks/9b1c7f...` |
| **Listen for test event** | Tùy chọn | Bấm nút này để hệ thống tạm chờ 1 sự kiện gửi tới URL trên trong 2 phút để hiển thị cấu trúc JSON thực tế mà không cần chạy workflow thật. | Bấm nút "Listen for test event" |

#### 4. Output Preview Schema (Dữ liệu sinh ra)
```json
{
  "json": {
    "body": {
      "order_id": "ORD-9988",
      "customer_email": "nguyenvana@gmail.com",
      "customer_name": "Nguyễn Văn A",
      "total_amount": 1250000
    },
    "headers": {
      "content-type": "application/json"
    },
    "query": {}
  }
}
```

#### 5. Danh sách Biểu thức copy dùng cho node sau:
- `{{$json.body.order_id}}` (Mã đơn hàng)
- `{{$json.body.customer_email}}` (Email khách hàng)
- `{{$json.body.customer_name}}` (Tên khách hàng)
- `{{$json.body.total_amount}}` (Tổng tiền đơn)
- `{{$node["Webhook"].json.body.order_id}}`

#### 6. Ví dụ cắm dây thực tế
```
[Webhook: Nhận đơn hàng mới] ──> [Filter: total_amount > 1tr] ──> [Send Gmail: Báo quản lý]
```

---

### 1.3. Messenger Trigger
* **Mã Catalog:** `messenger.trigger` | **Phân nhóm:** `TRIGGER`
* **Màu sắc / Icon:** Xanh Messenger `#0084FF` | Icon `message-circle`
* **Cổng ra:** 1 cổng mặc định

#### 1. Dùng để làm gì?
Tự động kích hoạt quy trình mỗi khi có khách hàng gửi tin nhắn văn bản hoặc bấm nút tương tác trên Fanpage Facebook của bạn.

#### 2. Điều kiện cần trước khi dùng
1. Bạn có một **Meta App** tạo tại <https://developers.facebook.com> (loại Business, đã thêm 2 sản phẩm: **Facebook Login** và **Messenger**).
2. Lấy **App ID** và **App Secret** từ mục *App settings → Basic*.
3. Thêm Credential `Facebook Messenger account` trong FlowPilot:
   - Dán App ID và App Secret.
   - Copy đường dẫn `OAuth Redirect URL` dán vào Meta App: *Facebook Login → Settings → Valid OAuth Redirect URIs*.
   - Bấm **Save & Connect** để đăng nhập Facebook và cấp quyền cho Fanpage.
4. Server có cấu hình `PUBLIC_BASE_URL` (Meta bắt buộc gọi Webhook qua HTTPS public).
5. Workflow phải được **Publish** và gạt công tắc **Active**.

#### 3. Hướng dẫn cấu hình từng trường
| Tên trường trên UI | Bắt buộc | Điền gì vào đây? | Ví dụ cụ thể |
|---|:---:|---|---|
| **Credential** | Có | Chọn tài khoản Facebook Messenger bạn đã kết nối ở bước chuẩn bị. | `Tài khoản Meta Shop ABC` |
| **Page** | Có | Chọn Fanpage mà bạn muốn lắng nghe tin nhắn (bấm ↻ nếu vừa thêm Page mới). | `Shop Thời Trang CrabFlow` |
| **Events** | Có | Loại sự kiện cần lắng nghe: <br>• `all`: Cả tin nhắn văn bản lẫn nút bấm.<br>• `message`: Chỉ tin nhắn văn bản.<br>• `postback`: Chỉ khi khách bấm nút tương tác. | `all` |
| **Keywords** | Không | (Tùy chọn) Danh sách từ khóa ngăn cách bằng dấu phẩy. Bot chỉ chạy khi tin nhắn có chứa từ này. Bỏ trống = nhận tất cả. | `giá, tư vấn, mua hàng` |

#### 4. Output Preview Schema (Dữ liệu sinh ra)
```json
{
  "json": {
    "type": "message",
    "message_id": "mid.1794031200:a8f9c1b2",
    "sender_id": "8492019481029481",
    "page_id": "100294819201948",
    "text": "Shop ơi cho mình hỏi giá bàn phím cơ bên bạn?",
    "payload": null,
    "timestamp": "2026-11-07T08:30:00.000Z"
  }
}
```

#### 5. Danh sách Biểu thức copy dùng cho node sau:
- **`{{$json.sender_id}}`** (ID người gửi - BẮT BUỘC dùng cho ô `Recipient ID` của các node gửi tin tiếp theo)
- **`{{$json.text}}`** (Nội dung tin nhắn khách vừa chat - Dùng đưa vào ô Prompt của AI)
- `{{$node["Messenger Trigger"].json.sender_id}}`
- `{{$node["Messenger Trigger"].json.text}}`

#### 6. Ví dụ cắm dây thực tế
```
[Messenger Trigger] ──> [Messenger Sender Action: typing_on] ──> [LLM: AI Trả lời] ──> [Messenger Send Message]
```

---

## NHÓM 2: CÁC NODE ĐIỀU HƯỚNG & LOGIC (LOGIC NODES)

Nhóm node này điều phối hướng đi của dữ liệu trong đồ thị (phân luồng, lọc bỏ hoặc rẽ nhánh).

---

### 2.1. IF (Rẽ 2 nhánh True / False)
* **Mã Catalog:** `logic.if` | **Phân nhóm:** `LOGIC`
* **Màu sắc / Icon:** Tím `#8B5CF6` | Icon `git-branch`
* **Cổng ra:** **2 cổng độc lập:** Cổng `True` (Đúng) và Cổng `False` (Sai).

#### 1. Dùng để làm gì?
So sánh điều kiện: Nếu thỏa mãn, dữ liệu đi tiếp vào nhánh `True`; nếu không thỏa mãn, dữ liệu đi vào nhánh `False`. Các node nối vào nhánh không được chọn sẽ tự động chuyển sang trạng thái `SKIPPED`.

#### 2. Điều kiện cần trước khi dùng
Cần có node phía trước cung cấp dữ liệu để so sánh.

#### 3. Hướng dẫn cấu hình từng trường
| Tên trường trên UI | Bắt buộc | Điền gì vào đây? | Ví dụ cụ thể |
|---|:---:|---|---|
| **Value 1 (Value)** | Có | Biểu thức chứa dữ liệu cần kiểm tra lấy từ node trước. | `{{$json.text}}` hoặc `{{$json.total}}` |
| **Operator** | Có | Chọn phép toán so sánh (`contains`, `equals`, `gt` - lớn hơn, `lt` - nhỏ hơn, `is_empty`, v.v.). | `contains` |
| **Value 2 (Compare to)** | Tùy chọn | Giá trị đem ra so sánh (tự động ẩn khi chọn phép toán `is_empty`/`is_not_empty`). | `giá` hoặc `1000000` |
| **Combine conditions** | Có | `All must match (AND)`: Mọi dòng điều kiện đều phải đúng.<br>`Any can match (OR)`: Chỉ cần 1 dòng đúng. | `All must match (AND)` |
| **Ignore case** | Có | Bật để không phân biệt chữ hoa / chữ thường. | `true` |
| **Ignore accents** | Có | Bật để bỏ qua dấu tiếng Việt (coi `"báo giá"` và `"bao gia"` như nhau). | `true` |

#### 4. Output Preview Schema
Dữ liệu gốc được truyền nguyên vẹn sang cổng `True` hoặc `False` tương ứng, không bị thay đổi cấu trúc.

---

### 2.2. Switch (Rẽ đa nhánh theo quy tắc)
* **Mã Catalog:** `logic.switch` | **Phân nhóm:** `LOGIC`
* **Màu sắc / Icon:** Tím `#8B5CF6` | Icon `split`
* **Cổng ra:** Đa cổng (mỗi quy tắc tạo ra 1 cổng riêng có nhãn) + 1 cổng `fallback`.

#### 1. Dùng để làm gì?
Phân loại dòng dữ liệu thành nhiều luồng nghiệp vụ khác nhau (tương đương lệnh switch-case). Ví dụ phân loại tin nhắn khách thành: *Nhánh 1: Hỏi giá*, *Nhánh 2: Khiếu nại*, *Nhánh 3: Bảo hành*, và các câu hỏi khác đi vào cổng mặc định *Fallback*.

#### 2. Hướng dẫn cấu hình từng trường
| Tên trường trên UI | Bắt buộc | Điền gì vào đây? | Ví dụ cụ thể |
|---|:---:|---|---|
| **Rules → Output name** | Có | Đặt tên cho cổng ra hiển thị trên Canvas. | `Hỏi giá` |
| **Rules → Conditions** | Có | Đặt điều kiện tương tự node IF (Value 1, Operator, Value 2). | Value 1: `{{$json.text}}`, Operator: `contains`, Value 2: `giá` |
| **Which rules (Mode)** | Có | `First match only`: Chỉ đi vào nhánh đầu tiên thỏa mãn.<br>`Every matching rule`: Nhân bản item vào tất cả các nhánh thỏa mãn. | `First match only` |

---

### 2.3. Filter (Lọc dữ liệu tuyến tính)
* **Mã Catalog:** `logic.filter` | **Phân nhóm:** `LOGIC`
* **Màu sắc / Icon:** Tím `#8B5CF6` | Icon `filter`
* **Cổng ra:** 1 cổng mặc định

#### 1. Dùng để làm gì?
Lọc bỏ các bản ghi không đạt yêu cầu trên một đường thẳng. Bản ghi nào thỏa mãn thì được đi tiếp; bản ghi nào không thỏa mãn sẽ bị dừng lại hoàn toàn.

#### 2. Hướng dẫn cấu hình từng trường
| Tên trường trên UI | Bắt buộc | Điền gì vào đây? | Ví dụ cụ thể |
|---|:---:|---|---|
| **Field Path** | Có | Tên trường cần lọc (LƯU Ý: Gõ tên trường trực tiếp, KHÔNG bọc trong dấu `{{}}`). | `status` hoặc `customer.age` |
| **Operator** | Có | Phép so sánh (`equals`, `not_equals`, `contains`). | `equals` |
| **Value** | Có | Giá trị so sánh (hỗ trợ biểu thức). | `PENDING` hoặc `active` |

---

## NHÓM 3: CÁC NODE XỬ LÝ DỮ LIỆU & BỘ NHỚ (DATA & MEMORY)

---

### 3.1. Edit Fields (Set)
* **Mã Catalog:** `data.set` | **Phân nhóm:** `DATA_PROCESSING`
* **Màu sắc / Icon:** Vàng cam `#F59E0B` | Icon `pencil`
* **Cổng ra:** 1 cổng mặc định

#### 1. Dùng để làm gì?
Tạo trường mới, gán lại giá trị, ghép chuỗi văn bản hoặc làm sạch dữ liệu trước khi gửi sang các hệ thống tiếp theo.

#### 2. Hướng dẫn cấu hình từng trường
| Tên trường trên UI | Bắt buộc | Điền gì vào đây? | Ví dụ cụ thể |
|---|:---:|---|---|
| **Fields → Name** | Có | Tên trường muốn gán (hỗ trợ đường dẫn lồng nhau dạng `customer.email`). | `full_name` hoặc `order.code` |
| **Fields → Value** | Có | Giá trị cần gán (hỗ trợ biểu thức). | `{{$json.first_name}} {{$json.last_name}}` |
| **Keep the other fields** | Có | `True`: Giữ lại các trường cũ.<br>`False`: Xóa sạch trường cũ, CHỈ giữ các trường vừa định nghĩa. | `true` |

#### 3. Output Preview Schema
```json
{
  "json": {
    "full_name": "Nguyễn Văn A",
    "greeting": "Xin chào Nguyễn Văn A!"
  }
}
```

---

### 3.2. Aggregate (Gom mảng dữ liệu)
* **Mã Catalog:** `data.aggregate` | **Phân nhóm:** `DATA_PROCESSING`
* **Màu sắc / Icon:** Vàng cam `#F59E0B` | Icon `layers`
* **Cổng ra:** 1 cổng mặc định

#### 1. Dùng để làm gì?
Khi node phía trước trả về danh sách nhiều dòng (ví dụ đọc 100 dòng từ Google Sheets), node Aggregate sẽ gom toàn bộ 100 dòng đó thành **1 item duy nhất** chứa mảng `items`. Rất tiện khi cần gửi 1 email tổng kết hoặc đưa vào AI để tóm tắt chung.

#### 2. Hướng dẫn cấu hình từng trường
| Tên trường trên UI | Bắt buộc | Điền gì vào đây? | Ví dụ cụ thể |
|---|:---:|---|---|
| **Field** | Có | Tên trường chứa mảng dữ liệu gom lại (mặc định là `items`). | `items` |

#### 3. Output Preview Schema
```json
{
  "json": {
    "items": [
      { "id": 1, "product": "Bàn phím cơ", "price": 850000 },
      { "id": 2, "product": "Chuột không dây", "price": 450000 }
    ]
  }
}
```

#### 4. Danh sách Biểu thức copy dùng cho node sau:
- `{{$json.items}}` (Toàn bộ mảng dữ liệu)
- `{{$json.items.length}}` (Số lượng phần tử trong mảng)
- `{{$json.items[0].product}}` (Dữ liệu phần tử đầu tiên)

---

### 3.3. Chat Memory (Bộ nhớ hội thoại Redis)
* **Mã Catalog:** `memory.chat` | **Phân nhóm:** `DATA_PROCESSING`
* **Màu sắc / Icon:** Xanh ngọc `#14B8A6` | Icon `brain`
* **Cổng ra:** 1 cổng mặc định

#### 1. Dùng để làm gì?
Lưu trữ và nạp lịch sử chat giữa khách hàng và Chatbot AI trên Redis. Giúp AI có "trí nhớ", không bị quên ngữ cảnh các câu nói trước của khách.

#### 2. Ba chế độ sử dụng (Action Mode)
1. **`Load the conversation` (Nạp lịch sử):** Đặt ở **TRƯỚC** node AI LLM.
2. **`Save a turn` (Lưu câu hỏi & trả lời):** Đặt ở **SAU** khi bot đã có câu trả lời.
3. **`Forget the conversation` (Xóa bộ nhớ):** Dùng khi khách bấm nút "Kết thúc chat".

#### 3. Hướng dẫn cấu hình từng trường
| Tên trường trên UI | Bắt buộc | Điền gì vào đây? | Ví dụ cụ thể |
|---|:---:|---|---|
| **Action (mode)** | Có | Chọn `Load the conversation` hoặc `Save a turn`. | `Load the conversation` |
| **Session key** | Có | Khóa định danh phiên chat của khách hàng. | `{{$node["Messenger Trigger"].json.sender_id}}` |
| **Turns to load** | Ở mode load | Số lượt chat tối đa cần nạp cho AI đọc (mặc định: 10). | `10` |
| **Customer message** | Ở mode save | Câu hỏi của khách hàng lấy từ Trigger. | `{{$node["Messenger Trigger"].json.text}}` |
| **Bot reply** | Ở mode save | Câu trả lời của AI lấy từ node LLM. | `{{$node["LLM"].json.text}}` |
| **Forget after (days)** | Ở mode save | Số ngày tự động hủy bộ nhớ trên Redis nếu khách không nhắn tiếp (mặc định: 7 ngày). | `7` |

#### 4. Output Preview Schema (Ở mode Load)
```json
{
  "json": {
    "history": [
      { "role": "user", "content": "Shop có bán bàn phím cơ không?" },
      { "role": "assistant", "content": "Dạ bên mình có nhiều mẫu bàn phím cơ chính hãng ạ!" }
    ],
    "history_text": "User: Shop có bán bàn phím cơ không?\nAssistant: Dạ bên mình có nhiều mẫu..."
  }
}
```

#### 5. Danh sách Biểu thức copy dùng cho node sau:
- **`{{$json.history}}`** (Dán vào ô *Conversation history* của node AI LLM)

---

## NHÓM 4: NODE TRÍ TUỆ NHÂN TẠO (AI LLM)

---

### 4.1. LLM (OpenAI, Anthropic Claude, Google Gemini)
* **Mã Catalog:** `ai.llm.generate` | **Phân nhóm:** `AI`
* **Màu sắc / Icon:** Xanh dương `#0EA5E9` | Icon `sparkles`
* **Cổng ra:** 1 cổng mặc định

#### 1. Dùng để làm gì?
Gửi yêu cầu tới các mô hình AI thông minh hàng đầu thế giới (GPT-4o, Claude 3.5 Sonnet, Gemini 2.0 Flash) để tạo câu trả lời tự động, tóm tắt dữ liệu, phân loại ý định hoặc bóc tách thông tin dạng JSON.

#### 2. Điều kiện cần trước khi dùng
Có API Key của nhà cung cấp AI tương ứng và đã kết nối Credential trong FlowPilot:
- OpenAI: `sk-...`
- Google Gemini: `AIza...`
- Anthropic Claude: `sk-ant-...`

#### 3. Hướng dẫn cấu hình từng trường
| Tên trường trên UI | Bắt buộc | Điền gì vào đây? | Ví dụ cụ thể |
|---|:---:|---|---|
| **Provider** | Có | Chọn nhà cung cấp: `openai`, `gemini`, hoặc `anthropic`. | `openai` |
| **Credential** | Có | Chọn khóa API Key tương ứng đã lưu. | `OpenAI API Key của tôi` |
| **Model** | Có | Nhập tên model AI muốn dùng. | `gpt-4o-mini` hoặc `gemini-2.0-flash` |
| **System prompt** | Không | Đóng vai và đặt quy tắc cho AI. | `Bạn là trợ lý bán hàng lịch sự, trả lời ngắn gọn trong 2-3 câu.` |
| **Conversation history** | Không | Nhập biểu thức nạp lịch sử chat từ node Chat Memory. | `{{$json.history}}` |
| **Prompt** | Có | Nội dung câu hỏi cần AI xử lý. | `{{$json.text}}` |
| **Output format** | Có | `text`: Văn bản thông thường.<br>`json`: Ép AI trả về JSON có cấu trúc. | `text` |
| **Temperature** | Không | Độ sáng tạo (0.0 đến 1.0; tư vấn bán hàng nên để 0.3 - 0.5). | `0.3` |
| **Max tokens** | Có | Độ dài tối đa câu trả lời (mặc định: 1024). | `1024` |

#### 4. Output Preview Schema (Dữ liệu sinh ra)
```json
{
  "json": {
    "text": "Dạ mẫu bàn phím cơ AK820 bên em đang có giá ưu đãi là 790.000 VNĐ kèm bảo hành 12 tháng ạ!",
    "model": "gpt-4o-mini",
    "usage": {
      "input_tokens": 128,
      "output_tokens": 38
    }
  }
}
```

#### 5. Danh sách Biểu thức copy dùng cho node sau:
- **`{{$json.text}}`** (Câu trả lời của AI - Dùng đưa vào ô *Text* của node gửi tin nhắn)
- `{{$node["LLM"].json.text}}`

---

## NHÓM 5: CÁC NODE TÍCH HỢP NGOÀI (INTEGRATION NODES)

---

### 5.1. Read Google Sheet Rows
* **Mã Catalog:** `integration.google_sheet.readRows` | **Phân nhóm:** `INTEGRATION`
* **Màu sắc / Icon:** Xanh lá Google `#34A853` | Logo Google Sheets
* **Cổng ra:** 1 cổng mặc định

#### 1. Dùng để làm gì?
Đọc toàn bộ các dòng từ một bảng tính Google Sheets. Mỗi dòng trong Sheet sẽ trở thành một item riêng biệt để chạy tuần tự qua các node phía sau.

#### 2. Điều kiện cần trước khi dùng
1. Kết nối tài khoản Google qua OAuth2 (Credential Google).
2. Đảm bảo tài khoản Google đã kết nối có quyền xem bảng tính.

#### 3. Hướng dẫn cấu hình từng trường
| Tên trường trên UI | Bắt buộc | Điền gì vào đây? | Ví dụ cụ thể |
|---|:---:|---|---|
| **Credential** | Có | Chọn tài khoản Google đã liên kết OAuth2. | `Tài khoản Google của tôi` |
| **Spreadsheet ID** | Có | Chuỗi ID nằm giữa `/d/` và `/edit` trong link trình duyệt của Google Sheet. | `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms` |
| **Sheet Name** | Có | Tên của Tab trang tính cần đọc dữ liệu. | `Sheet1` hoặc `Danh sách khách hàng` |

#### 4. Output Preview Schema (Dữ liệu sinh ra)
```json
{
  "json": {
    "row_number": 2,
    "Họ và tên": "Nguyễn Văn A",
    "Email": "nguyenvana@gmail.com",
    "Số điện thoại": "0912345678",
    "Trạng thái": "Chưa gửi"
  }
}
```

#### 5. Danh sách Biểu thức copy dùng cho node sau:
- `{{$json["Họ và tên"]}}`
- `{{$json.Email}}`
- `{{$json["Số điện thoại"]}}`

---

### 5.2. Send Gmail
* **Mã Catalog:** `integration.gmail.send` | **Phân nhóm:** `INTEGRATION`
* **Màu sắc / Icon:** Đỏ Gmail `#EA4335` | Logo Gmail
* **Cổng ra:** 1 cổng mặc định

#### 1. Dùng để làm gì?
Gửi email tự động thông qua tài khoản Gmail cá nhân hoặc Google Workspace.

#### 2. Hướng dẫn cấu hình từng trường
| Tên trường trên UI | Bắt buộc | Điền gì vào đây? | Ví dụ cụ thể |
|---|:---:|---|---|
| **Credential** | Có | Chọn tài khoản Google có quyền gửi mail. | `Tài khoản Google của tôi` |
| **Recipient (To)** | Có | Email người nhận (hỗ trợ biểu thức). | `{{$json.Email}}` hoặc `khachhang@gmail.com` |
| **Subject** | Có | Tiêu đề thư (hỗ trợ biểu thức). | `[Xác nhận] Đơn hàng của bạn đã sẵn sàng` |
| **Body** | Có | Nội dung email (hỗ trợ nhiều dòng và biểu thức). | `Xin chào {{$json["Họ và tên"]}},\n\nCảm ơn bạn đã quan tâm...` |

#### 3. Output Preview Schema
```json
{
  "json": {
    "message_id": "18c2f1a980b192cd",
    "to": "nguyenvana@gmail.com",
    "sent": true
  }
}
```

---

### 5.3. Messenger Send Message
* **Mã Catalog:** `messenger.sendMessage` | **Phân nhóm:** `INTEGRATION`
* **Màu sắc / Icon:** Xanh Messenger `#0084FF` | Icon `send`
* **Cổng ra:** 1 cổng mặc định

#### 1. Dùng để làm gì?
Gửi tin nhắn phản hồi cho khách hàng trên Facebook Messenger (hỗ trợ văn bản, nút bấm nhanh Quick Replies, thẻ nút bấm hoặc gửi ảnh/file).

#### 2. Hướng dẫn cấu hình từng trường
| Tên trường trên UI | Bắt buộc | Điền gì vào đây? | Ví dụ cụ thể |
|---|:---:|---|---|
| **Page** | Có | Chọn Fanpage gửi tin. | `Shop Thời Trang CrabFlow` |
| **Recipient ID** | Có | ID khách hàng nhận tin (BẮT BUỘC dùng biểu thức lấy từ Trigger). | `{{$node["Messenger Trigger"].json.sender_id}}` |
| **Message type** | Có | `text`: Văn bản thuần túy.<br>`quick_replies`: Văn bản kèm nút bấm nhanh biến mất sau khi bấm.<br>`buttons`: Thẻ chứa nút bấm cố định.<br>`attachment`: Gửi ảnh/file qua link công khai. | `text` hoặc `quick_replies` |
| **Text** | Có | Nội dung tin nhắn gửi đi (lấy từ AI hoặc gõ trực tiếp). | `{{$node["LLM"].json.text}}` |

#### 3. Output Preview Schema
```json
{
  "json": {
    "page_id": "100294819201948",
    "recipient_id": "8492019481029481",
    "message_id": "m_1792837192",
    "status": "sent"
  }
}
```

---

### 5.4. Messenger Sender Action
* **Mã Catalog:** `messenger.senderAction` | **Phân nhóm:** `INTEGRATION`
* **Màu sắc / Icon:** Xanh Messenger `#0084FF` | Icon `ellipsis`
* **Cổng ra:** 1 cổng mặc định

#### 1. Dùng để làm gì?
Hiển thị trạng thái tương tác như "Đang soạn tin..." (`typing_on`) hoặc "Đã xem" (`mark_seen`) trong lúc hệ thống đang gọi AI hoặc xử lý ngầm, tạo trải nghiệm tự nhiên cho khách.

#### 2. Hướng dẫn cấu hình từng trường
| Tên trường trên UI | Bắt buộc | Điền gì vào đây? | Ví dụ cụ thể |
|---|:---:|---|---|
| **Page** | Có | Chọn Fanpage. | `Shop Thời Trang CrabFlow` |
| **Recipient ID** | Có | ID khách hàng nhận tín hiệu. | `{{$node["Messenger Trigger"].json.sender_id}}` |
| **Action** | Có | `typing_on` (Hiện ba chấm đang gõ)<br>`typing_off` (Tắt đang gõ)<br>`mark_seen` (Đánh dấu đã xem) | `typing_on` |

---

### 5.5. HTTP Request (Bảo vệ SSRF Guard)
* **Mã Catalog:** `http.request` | **Phân nhóm:** `INTEGRATION`
* **Màu sắc / Icon:** Xám Slate `#475569` | Icon `globe`
* **Cổng ra:** 1 cổng mặc định

#### 1. Dùng để làm gì?
Gọi bất kỳ Web API REST bên ngoài nào trên Internet (gửi dữ liệu sang CRM, ERP nội bộ, cổng thanh toán hoặc hệ thống SaaS).

#### 2. Hướng dẫn cấu hình từng trường
| Tên trường trên UI | Bắt buộc | Điền gì vào đây? | Ví dụ cụ thể |
|---|:---:|---|---|
| **Method** | Có | Chọn `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. | `POST` |
| **URL** | Có | Đường dẫn endpoint API (hỗ trợ biểu thức). | `https://api.crm.com/v1/leads` |
| **Authentication** | Có | `None`, `Header (API Key)`, `Bearer token`, `Basic auth`. | `Bearer token` |
| **Headers** | Không | Danh sách Header gửi kèm request. | `Content-Type`: `application/json` |
| **Body** | Không | Dữ liệu gửi đi dạng JSON hoặc Text (hỗ trợ biểu thức). | `{"customer_id": "{{$json.id}}", "status": "synced"}` |

#### 3. Output Preview Schema
```json
{
  "json": {
    "status": 200,
    "data": {
      "success": true,
      "lead_id": 99821
    },
    "headers": {
      "content-type": "application/json"
    }
  }
}
```

---

## 7. BẢNG TRA CỨU BIỂU THỨC "COPY DÙNG NGAY" CHO TOÀN BỘ 15 NODE

| Khi muốn lấy dữ liệu từ Node: | Tên trường cần lấy: | Công thức Biểu thức Copy Dùng Ngay: |
|---|---|---|
| **Messenger Trigger** | ID khách hàng (người gửi) | `{{$node["Messenger Trigger"].json.sender_id}}` |
| **Messenger Trigger** | Nội dung tin nhắn khách chat | `{{$node["Messenger Trigger"].json.text}}` |
| **Messenger Trigger** | Mã Fanpage | `{{$node["Messenger Trigger"].json.page_id}}` |
| **Webhook** | Dữ liệu trong Body | `{{$json.body.tên_thuộc_tính}}` |
| **LLM (AI)** | Câu trả lời của AI | `{{$node["LLM"].json.text}}` hoặc `{{$json.text}}` |
| **Chat Memory** | Lịch sử chat (để nạp vào LLM) | `{{$json.history}}` |
| **Google Sheet** | Cột trong bảng tính | `{{$json["Tên Cột"]}}` (ví dụ `{{$json.Email}}`) |
| **Aggregate** | Mảng dữ liệu gom lại | `{{$json.items}}` |
| **Aggregate** | Số phần tử trong mảng gom | `{{$json.items.length}}` |
| **Edit Fields** | Trường mới vừa tạo | `{{$json.tên_trường_mới}}` |
| **HTTP Request** | Kết quả trả về từ API | `{{$json.data}}` hoặc `{{$json.status}}` |

---

## 8. BÍ KÍP BẢO VỆ ĐỒ ÁN: 10 CÂU HỎI HỘI ĐỒNG HAY "SẤY" NHẤT

```
                  ┌─────────────────────────────────────────────────┐
                  │   CHIẾN THUẬT PHẢN BIỆN ĐỒ ÁN CRABFLOWPILOT    │
                  └─────────────────────────────────────────────────┘
                   1. Luôn nhắc tới tính chuẩn hóa Schema (NFR-01)
                   2. Khẳng định Expression Engine KHÔNG dùng eval()
                   3. Phân biệt rõ WorkflowDraft vs WorkflowVersion
                   4. Nêu bật an ninh: SSRF Guard + AES-256-GCM
                   5. Hiểu sâu cơ chế DAG Topological Sort & Skip
```

#### Câu 1: *"Tại sao nhóm dùng JSON Schema mở rộng (`x-*`) thay vì tự code sẵn các form trên Frontend cho nhanh và đẹp?"*
> **Trả lời:** *"Dạ thưa Thầy/Cô, nhóm thiết kế theo **Phi chức năng NFR-01 (Khả năng mở rộng không chạm code - Zero-Code Extension)**. Nếu hard-code form trên React, mỗi khi tích hợp thêm một node mới (ví dụ Telegram, Zalo OA hay Slack), lập trình viên bắt buộc phải sửa code Frontend, build lại giao diện và deploy lại toàn bộ hệ thống. Với kiến trúc **Metadata-driven UI**, Backend chỉ cần khai báo một Schema JSON lưu trong database hoặc package registry. Frontend React sở hữu component `ConfigField` động, tự động đọc Schema để render đúng picker, ô nhập, dropdown enum mà không cần thay đổi 1 dòng code React nào."*

#### Câu 2: *"Dữ liệu truyền giữa các node theo cơ chế nào? Các node có dùng chung một Global State hay biến toàn cục không?"*
> **Trả lời:** *"Dạ hoàn toàn **KHÔNG dùng Global State**. Dữ liệu được truyền theo mô hình **Item-based Stream Pipeline** bất biến (`Array<{ json: Record<string, unknown> }>`). Node sau nhận output node trước. Khi cần đọc lại dữ liệu của node cũ ở phía trước (ví dụ node thứ 5 đọc `sender_id` của Trigger ban đầu), Execution Engine cung cấp cơ chế **Topological Run State Lookup** qua biểu thức `{{$node["Tên Node"].json.trường}}` mà không làm biến đổi dữ liệu gốc."*

#### Câu 3: *"Biểu thức `{{ ... }}` phân tích thế nào? Nhóm có dùng hàm `eval()` không? Có nguy cơ bị dính lỗ hổng Remote Code Execution (RCE) không?"*
> **Trả lời:** *"Dạ nhóm **TUYỆT ĐỐI KHÔNG sử dụng `eval()` hay `new Function()`**. Toàn bộ biểu thức được phân giải thông qua một bộ **Safe Expression Parser & AST Resolver** tự xây dựng (`libs/execution/src/domain/expression`). Parser chỉ cho phép duyệt thuộc tính an toàn như `$json.field`, `$node["Tên"]`, `$index` và từ chối 100% mọi lệnh thực thi nguy hiểm, miễn nhiễm hoàn toàn với RCE."*

#### Câu 4: *"Đối với node `IF` hoặc `Switch`, khi một nhánh không thỏa mãn điều kiện thì các node phía sau nhánh đó có chạy không?"*
> **Trả lời:** *"Dạ các node thuộc nhánh không thỏa mãn sẽ **KHÔNG chạy** và được đánh dấu là trạng thái **`SKIPPED`**. Đồ thị được sắp xếp theo **Topological Sort**. Các node rẽ nhánh sở hữu các cổng ra có tên (`true`, `false`, `rule_<id>`). Một cạnh chỉ kích hoạt khi node nguồn phát ra item vào cổng đó. Khi duyệt tới một node mà không có cạnh kích hoạt nào dẫn vào, node đó chuyển sang trạng thái `SKIPPED`, ghi log rỗng và tiếp tục truyền cờ bỏ qua xuống các node con phía sau (Skip Propagation)."*

#### Câu 5: *"Lỗ hổng SSRF là gì và node HTTP Request của nhóm phòng chống thế nào nếu người dùng gõ URL nội bộ như `http://localhost:5433` (Postgres) hay `http://169.254.169.254` (Cloud Metadata)?"*
> **Trả lời:** *"Dạ có lớp bảo vệ **SSRF Guard (`safe-request`)**: Hệ thống phân giải DNS trước và đối chiếu chặn ngay lập tức toàn bộ các dải IP Private/Loopback (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`). Đồng thời dùng kỹ thuật **Connection Pinning** ghim IP hợp lệ để kết nối trực tiếp chống tấn công DNS Rebinding, kèm giới hạn payload 5MB và timeout 30s."*

#### Câu 6: *"Tại sao Webhook của Messenger hay bên thứ ba gọi tới nhóm lại trả kết quả 202 Accepted ngay mà không đợi cả quy trình chạy xong?"*
> **Trả lời:** *"Dạ vì Meta chỉ cho phép timeout tối đa 3-5 giây. Controller Webhook xác thực chữ ký (HMAC-SHA256) xong sẽ trả ngay mã `200/202 Accepted` cho đối tác chỉ trong **30 - 50ms**, sau đó đóng gói Job đẩy vào hàng đợi **BullMQ (Redis)** để các Worker ngầm chạy độc lập theo mức độ chịu tải `EXECUTION_CONCURRENCY`, chống nghẽn và chống retry storm."*

#### Câu 7: *"Tại sao Chat Memory nhóm lại dùng Redis mà không lưu thẳng vào PostgreSQL?"*
> **Trả lời:** *"Dạ có 3 lý do: (1) **Độ trễ < 1ms** trên RAM giúp chatbot phản hồi mượt mà; (2) **Tính năng TTL tự nhiên** tự động dọn dẹp phiên sau 7 ngày mà không cần chạy cronjob dọn rác DB; (3) **Cấu trúc List (`RPUSH`, `LRANGE`)** của Redis cực kỳ tối ưu cho việc trượt cửa sổ hội thoại (Sliding Window 10 lượt chat gần nhất)."*

#### Câu 8: *"Nhóm làm sao giải quyết bài toán người dùng đang sửa workflow trên Canvas nhưng workflow đó đang được Active ngoài thực tế?"*
> **Trả lời:** *"Dạ hệ thống áp dụng cơ chế **Zero-Data-Loss Versioning**: Bảng `WorkflowDraft` lưu trạng thái chỉnh sửa đang diễn ra trên Canvas, còn Webhook ngoài đời chỉ lắng nghe trên `WorkflowVersion` (bản đã Publish). Người dùng có thể thoải mái sửa đổi trên bản nháp mà bot live bên ngoài vẫn chạy ổn định theo phiên bản đã xuất bản."*

#### Câu 9: *"Các thông tin nhạy cảm như API Key của OpenAI, App Secret Facebook hay Google OAuth Token được bảo mật như thế nào trong CSDL?"*
> **Trả lời:** *"Dạ toàn bộ thông tin nhạy cảm được mã hóa tĩnh (**Encryption at Rest**) bằng thuật toán đối xứng chuẩn quân đội **AES-256-GCM** với một `ENCRYPTION_KEY` 256-bit độc lập lưu tại biến môi trường máy chủ, tuyệt đối không lưu plaintext."*

#### Câu 10: *"Nếu Webhook gửi tin nhắn bị lặp lại (Meta gửi cùng 1 message 2 lần do mạng chập chờn), hệ thống xử lý thế nào để không gửi 2 tin trả lời?"*
> **Trả lời:** *"Dạ có cơ chế **Deduplication** dùng lệnh nguyên tử `SET NX` trên Redis với khóa `dedup:{endpointId}:{message_id}` trong 24 giờ. Nếu tin nhắn trùng gửi lại, hàm `claim()` trả về `false`, hệ thống lập tức bỏ qua (`ignored = 1`) và chỉ trả mã 200 OK cho Meta mà không tạo thêm lượt chạy nào, đảm bảo tính **Idempotency 100%**."*
