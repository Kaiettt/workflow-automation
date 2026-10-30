# Spec: Node cho chatbot (tiếp nối chat-trigger)

## 1. Bối cảnh

Nhánh `chat-trigger` đã có Messenger Trigger, Messenger Send Message, Webhook, công tắc Active và test event. Dựng thử chatbot Messenger thì thấy còn thiếu những thứ mà n8n có sẵn:

| Việc | n8n | FlowPilot hiện tại |
|---|---|---|
| Nhận tin | Facebook Trigger, Webhook | Có |
| Gửi tin văn bản | HTTP Request gọi Send API | Có (`messenger.sendMessage`) |
| Rẽ nhánh theo nội dung | IF, Switch | **Không có.** Engine chỉ chạy một chuỗi thẳng (`getExecutionOrder` báo lỗi khi một node có hai cạnh ra). Publish lại cho qua, nên workflow có nhánh publish được rồi mới lỗi lúc chạy. |
| Đặt / ghép dữ liệu | Edit Fields (Set), Code | Không có |
| Nhớ hội thoại | Window Buffer / Redis Chat Memory | Không có, mỗi tin nhắn là một execution độc lập, LLM không biết khách vừa nói gì |
| Gửi nút bấm, trả lời nhanh, ảnh, "đang gõ" | HTTP Request tự dựng JSON | Không có |
| Nhận postback (khách bấm nút) | Facebook Trigger | Bị bỏ qua (`parseMessengerEvents` chỉ lấy `message`) |
| Gọi API ngoài | HTTP Request | Không có |
| Lọc | Filter | Có (`logic.filter`, 3 toán tử) |
| AI | AI Agent + Chat Model | Có LLM một lượt (`ai.llm.generate`) |

## 2. Mục tiêu

Dựng được chatbot Messenger thực tế mà không cần viết code:

> Khách nhắn → **Switch** theo nội dung (hỏi giá / gặp người thật / còn lại)
> → nhánh "còn lại": **Chat Memory (load)** → **LLM** (có lịch sử) → **Messenger Send** (kèm quick replies) → **Chat Memory (save)**
> → nhánh "gặp người thật": **Messenger Send** "Mình chuyển cho nhân viên nhé"
> → khách bấm quick reply → **postback** vào lại trigger.

## 3. Phạm vi

### P1. Rẽ nhánh (engine chạy đồ thị)
- Engine chạy đồ thị có hướng không chu trình (DAG) thay cho chuỗi thẳng: một node có nhiều cạnh ra, nhiều node gộp về một node.
- Node có thể khai báo **nhiều đầu ra có tên**. Cạnh lưu đầu ra nào nó nối từ.
- Node chỉ chạy khi có ít nhất một cạnh vào được "kích hoạt". Node không chạy thì ghi log `SKIPPED`, các node phía sau nó cũng `SKIPPED`.
- Workflow chuỗi thẳng hiện có chạy y như cũ.
- Publish báo lỗi khi đồ thị có chu trình (`GRAPH_CYCLE`).
- Biểu thức `$node["Tên"].json` vẫn tìm đúng item tương ứng qua nhánh và qua chỗ gộp.

### P2. Node logic và dữ liệu
- **IF** (`logic.if`): đầu ra `true` / `false`, một hoặc nhiều điều kiện nối bằng AND/OR.
- **Switch** (`logic.switch`): danh sách luật, mỗi luật là một đầu ra có nhãn, cộng đầu ra `fallback`. Item đi vào luật khớp đầu tiên (tuỳ chọn: mọi luật khớp).
- Toán tử dùng chung: `equals`, `not_equals`, `contains`, `not_contains`, `starts_with`, `ends_with`, `regex`, `is_empty`, `is_not_empty`, `gt`, `lt`. Tuỳ chọn bỏ qua hoa thường và dấu (dùng lại `matchesKeywords` / chuẩn hoá đã có).
- **Edit Fields** (`data.set`): đặt các trường `tên = giá trị` (cho phép biểu thức), tuỳ chọn giữ hay bỏ trường cũ.

### P3. Trí nhớ hội thoại
- **Chat Memory** (`memory.chat`), chế độ:
  - `load`: đọc N lượt gần nhất của một phiên, trả `history` (mảng `{role, content}`) và `history_text` (dạng "Khách: …\nBot: …").
  - `save`: thêm một lượt (tin khách + câu trả lời).
  - `clear`: xoá phiên (cho lệnh "bắt đầu lại").
- Khoá phiên mặc định `{{$node["Messenger Trigger"].json.sender_id}}`, phạm vi theo workflow. Giữ tối đa 50 lượt, tự hết hạn sau 7 ngày không dùng (cấu hình được).
- **LLM** thêm trường tuỳ chọn `history` (biểu thức trỏ tới mảng `{role, content}`) để gửi dạng hội thoại nhiều lượt cho provider.

### P4. Messenger đầy đủ hơn
- **Trigger** nhận thêm `postback` (khách bấm nút) và `quick_reply.payload`; thêm trường `payload` vào output. Tuỳ chọn lọc loại sự kiện: tin nhắn / postback / cả hai.
- **Send Message** thêm:
  - Quick replies (tối đa 13, mỗi cái `title` + `payload`).
  - Nút bấm (button template, tối đa 3 nút: postback hoặc URL).
  - Gửi ảnh / file theo URL.
- **Sender Action** (`messenger.senderAction`): `typing_on`, `typing_off`, `mark_seen`.
- Lỗi ngoài cửa sổ 24 giờ của Meta báo rõ ràng ("Khách nhắn lần cuối quá 24 giờ, Meta không cho gửi tin thường").

### P5. HTTP Request
- **HTTP Request** (`http.request`): method, URL, query, header, body JSON/form/raw, timeout, trả `status`, `headers`, `body` (tự parse JSON).
- Credential tuỳ chọn: Header Auth, Bearer Token, Basic Auth.
- Chặn gọi tới địa chỉ nội bộ (localhost, dải IP riêng, metadata cloud) để tránh SSRF; cho phép tắt bằng biến môi trường khi chạy local.

### P6. Sửa nhỏ đi kèm
- Lỗi "Node "X" was not found" gợi ý tên gần đúng (ví dụ khác hoa thường: `messenger Trigger` → `Messenger Trigger`).

## 4. Ngoài phạm vi
- AI Agent dùng công cụ (tool calling), Code node (JS/Python), Wait / chờ khách trả lời trong cùng một execution, Loop, Merge có chế độ (chỉ gộp bằng nối danh sách), Error Trigger / continue on fail, Schedule trigger, Zalo, Telegram.
- Chế độ "một Meta App dùng chung" cho người dùng ngoài.

## 5. Tiêu chí hoàn thành
- Workflow ở mục 2 dựng được trên designer, publish được, và chạy đúng từng nhánh (kiểm bằng e2e với Graph API giả).
- Workflow chuỗi thẳng cũ (bao gồm e2e hiện có) không đổi kết quả.
- Unit test cho engine DAG (nhánh, gộp, skip, chu trình, pairing qua nhánh), IF/Switch/Set, Chat Memory, HTTP Request (kể cả chặn SSRF), Messenger mới.
- Frontend: node nhiều đầu ra hiển thị handle có nhãn; cạnh nhớ đầu ra; log execution hiện `SKIPPED`.
