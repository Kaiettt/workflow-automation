# Technical Design: Node Documentation, In-App Inspector & Templates

## 1. Hiện trạng & Thách thức Kiến trúc

- Hiện tại, `PropertiesPanel.tsx` chỉ hiển thị danh sách các field cấu hình lấy từ `nodeType.configSchema.properties`.
- Node Catalog trong `node_type_definitions` đã có cột `output_schema` (`outputSchema` trong Prisma/Entity) nhưng hầu hết các node đang để `null` hoặc chỉ là schema trừu tượng, không có dữ liệu mẫu trực quan (`sample_output`).
- Người dùng khi chọn một node không biết node đó phát ra những trường gì, nên không biết cú pháp viết biểu thức ở node sau.

---

## 2. Thiết kế Kỹ thuật (Technical Architecture)

### 2.1. Nguồn dữ liệu cho Output Preview (2 Chế độ)

Để Inspector hoạt động hiệu quả cả khi workflow chưa chạy lẫn khi đã chạy thật:

```
┌────────────────────────────────────────────────────────┐
│               NODE OUTPUT INSPECTOR                    │
└────────────────────────────────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    [Chế độ 1: Dữ liệu mẫu]     [Chế độ 2: Dữ liệu thật]
    Khi node chưa từng chạy:     Khi đã có test event hoặc
    Lấy từ `sampleOutput`        kết quả execution gần nhất:
    được định nghĩa tĩnh         Lấy từ `ExecutionNodeLog`
    trong Node Catalog           hoặc `TestEventStore`
```

1. **Chế độ 1 (Static Sample Output):** Mỗi node type được bổ sung một đối tượng `sampleOutput` chuẩn. Bất kỳ lúc nào người dùng click vào node, Inspector đều có thể render ngay cấu trúc dữ liệu JSON này.
2. **Chế độ 2 (Live / Test Event Data):** Nếu node là Trigger đã bấm "Listen for test event" thành công, hoặc workflow vừa chạy thử, Inspector sẽ ưu tiên hiển thị JSON dữ liệu thật.

### 2.2. Bảng Catalog Mẫu dữ liệu đầu ra (Sample Output Catalog)

| Node Key | Cấu trúc Sample Output JSON | Các biểu thức chính gợi ý cho node sau |
|---|---|---|
| `trigger.manual` | `{}` | Không có |
| `webhook.trigger` | `{"body": {"order_id": "123", "amount": 500000}, "headers": {...}, "query": {...}}` | `{{$json.body.order_id}}`, `{{$json.body.amount}}` |
| `messenger.trigger` | `{"sender_id": "8492019481029481", "page_id": "100294819201948", "text": "Hỏi giá sản phẩm", "timestamp": 1792837192000}` | `{{$json.sender_id}}`, `{{$json.text}}` |
| `logic.if` | *(Giữ nguyên input truyền qua nhánh `true` hoặc `false`)* | Tương đương input đầu vào |
| `logic.switch` | *(Giữ nguyên input truyền qua cổng `rule_<id>` hoặc `fallback`)* | Tương đương input đầu vào |
| `logic.filter` | *(Giữ nguyên input nếu thỏa mãn điều kiện lọc)* | Tương đương input đầu vào |
| `data.set` | `{"...các_trường_cũ", "tên_trường_mới": "giá trị"}` | `{{$json.tên_trường_mới}}` |
| `data.aggregate` | `{"items": [{"id": 1}, {"id": 2}]}` | `{{$json.items}}`, `{{$json.items.length}}` |
| `memory.chat` | `{"history": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}], "history_text": "..."}` | `{{$json.history}}` |
| `ai.llm.generate` | `{"text": "Câu trả lời của AI...", "model": "gpt-4o-mini", "usage": {"input_tokens": 150, "output_tokens": 45}}` | `{{$json.text}}`, `{{$json.usage.output_tokens}}` |
| `http.request` | `{"status": 200, "data": {"success": true, "user_id": 99}, "headers": {...}}` | `{{$json.data.user_id}}`, `{{$json.status}}` |
| `integration.google_sheet.readRows` | `{"row_number": 2, "Họ và tên": "Nguyễn Văn A", "Email": "a@example.com", "Số điện thoại": "0912345678"}` | `{{$json.Email}}`, `{{$json["Họ và tên"]}}` |
| `integration.gmail.send` | `{"message_id": "18c2f1a9...", "to": "user@example.com", "sent": true}` | `{{$json.message_id}}`, `{{$json.sent}}` |
| `messenger.sendMessage` | `{"recipient_id": "8492019481029481", "message_id": "mid.179...", "status": "sent"}` | `{{$json.message_id}}`, `{{$json.status}}` |
| `messenger.senderAction` | `{"recipient_id": "8492019481029481", "action": "typing_on", "status": "sent"}` | `{{$json.status}}` |

---

## 3. Thiết kế Giao diện (Frontend Component Design)

### 3.1. Cấu trúc Tabs trong `PropertiesPanel`

Trong `PropertiesPanel.tsx`, chia làm 2 Tabs rõ ràng bằng shadcn/ui Tabs:
- **Tab 1: Cấu hình (Parameters):** Chứa các trường nhập liệu hiện tại (`ConfigField`).
- **Tab 2: Dữ liệu đầu ra (Output Preview & Inspector):**
  - Hiển thị khối JSON Output được format đẹp (code block có màu).
  - Có danh sách các trường dữ liệu quan trọng dưới dạng danh sách "Quick-Copy Chips":
    - Bấm vào một chip -> Tự động copy `{{$node["Tên Node"].json.fieldName}}` vào clipboard.
    - Hiển thị toast thông báo ngắn: *"Đã sao chép biểu thức vào bộ nhớ tạm!"*.

### 3.2. Cấu trúc Thư viện Templates (`WorkflowTemplates`)

Lưu trữ danh sách các template tại `frontend/src/features/workflow/templates/catalog.ts`:
Mỗi template gồm:
- `id`: Mã template (e.g. `messenger-ai-chatbot`).
- `title`: Tên quy trình (e.g. `Chatbot AI Messenger với Trí nhớ Redis`).
- `description`: Mô tả công dụng và kịch bản hoạt động.
- `tags`: Nhãn phân loại (`AI`, `Messenger`, `Google Sheets`, `Email`).
- `definition`: Đối tượng `{ nodes, edges }` hoàn chỉnh với các biểu thức chuẩn đã được cắm sẵn dây.

Người dùng bấm **"Dùng mẫu này (Use Template)"** -> Tự động nạp `nodes` và `edges` lên Canvas, tự động lưu Draft và mở ra sẵn sàng để kết nối Credential.

