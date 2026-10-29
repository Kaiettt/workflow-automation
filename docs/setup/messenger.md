# Kết nối Facebook Messenger

Hướng dẫn để workflow tự chạy khi khách nhắn tin vào Facebook Page, và trả lời lại trên Messenger.

> Spec: `specs/chat-trigger/`. Các bước ở mục 1–3 phải do **chủ tài khoản Facebook** tự làm.

## Tổng quan

```
Khách nhắn tin vào Page
  → Meta gọi POST {PUBLIC_BASE_URL}/api/webhooks/messenger (có chữ ký)
  → FlowPilot tìm workflow đang lắng nghe Page đó, chạy nền
  → Node "Send Messenger Message" trả lời qua Graph API bằng Page Access Token
```

Cần 3 giá trị:

| Giá trị | Lấy ở đâu | Điền vào |
|---|---|---|
| App Secret | Meta App → App settings → Basic | `META_APP_SECRET` trong `monolith-backend/.env` |
| Verify token | Tự đặt một chuỗi bất kỳ | `META_VERIFY_TOKEN` trong `.env` **và** ô Verify token trên Meta |
| Page ID + Page Access Token | Meta App → Messenger → API Setup | Form "Connect Facebook Messenger" trong FlowPilot |

## 1. Chuẩn bị Page và App

1. Tạo một **Facebook Page riêng để thử** (không dùng Page thật của shop).
2. Vào <https://developers.facebook.com>, đăng ký tài khoản developer nếu chưa có.
3. **Create App** → chọn loại **Business** (hoặc use case "Engage with customers on Messenger").
4. Trong App, thêm sản phẩm **Messenger**.
5. **App settings → Basic** → bấm Show ở **App Secret** → copy vào `.env`:
   ```
   META_APP_SECRET=...
   META_VERIFY_TOKEN=mot-chuoi-tu-dat
   META_GRAPH_VERSION=v23.0
   ```
   `META_GRAPH_VERSION`: dùng version API đang hiển thị trên dashboard của App.

## 2. Mở URL public cho backend

Meta chỉ gọi được URL HTTPS public. Khi dev trên máy:

```bash
cloudflared tunnel --url http://localhost:8081
```

Lệnh in ra một URL `https://<tên>.trycloudflare.com`. Đặt nó làm `PUBLIC_BASE_URL` trong `.env` rồi **khởi động lại backend**.

> URL `trycloudflare.com` đổi mỗi lần chạy lại lệnh → phải sửa lại Callback URL ở bước 3.

## 3. Cấu hình webhook trên Meta

Backend và tunnel phải **đang chạy**.

1. **Messenger → Messenger API Settings (hoặc Webhooks)**:
   - Callback URL: `{PUBLIC_BASE_URL}/api/webhooks/messenger`
   - Verify token: đúng chuỗi `META_VERIFY_TOKEN`
   - Bấm **Verify and save**. Nếu báo lỗi: kiểm tra backend đã đọc `.env` mới chưa (khởi động lại), và URL tunnel còn sống.
2. Phần **Webhook fields**: bật **`messages`**. (Không cần `message_echoes`.)
3. Phần **Generate access tokens**: liên kết Page → **Generate** → copy **Page Access Token**. Ghi lại **Page ID** hiển thị cạnh tên Page.
4. Đảm bảo Page đã được **subscribe** vào App (nút Add Subscriptions / tick `messages` cho Page).

### Chế độ Development

Khi App chưa qua App Review, **chỉ người có vai trò trong App** (Admin / Developer / Tester) nhắn tin mới kích hoạt webhook. Vào **App roles → Roles** để thêm tài khoản Facebook dùng để thử làm Tester. Muốn khách thật dùng được thì phải gửi App Review xin quyền `pages_messaging` — không cần cho việc thử.

## 4. Tạo workflow trong FlowPilot

1. Kéo **Messenger Trigger** → chọn **Facebook Page** → **+ Add connection** → nhập tên, **Page ID**, **Page Access Token** → Save.
2. Ví dụ chatbot AI: thêm **LLM** rồi **Send Messenger Message**, nối `Messenger Trigger → LLM → Send Messenger Message`.
   - LLM `prompt`: `Bạn là nhân viên CSKH. Trả lời ngắn gọn: {{$json.text}}`
   - Send `Facebook Page`: cùng connection; `Recipient ID`: `{{$node["Messenger Trigger"].json.sender_id}}`; `Text`: `{{$json.text}}`
   - Nếu node Send đứng **ngay sau** trigger, giữ mặc định `{{$json.sender_id}}`.
3. **Publish**. Mỗi Page chỉ gắn được với **một** workflow đang chạy; nếu Page đã dùng ở workflow khác, publish báo lỗi và nêu tên workflow đó.
4. Dùng tài khoản Tester nhắn tin vào Page → nhận câu trả lời.

Dữ liệu trigger đưa vào workflow (`$json`):

```json
{
  "channel": "messenger",
  "message_id": "m_...",
  "sender_id": "id của khách (theo Page)",
  "recipient_id": "Page ID",
  "text": "nội dung tin nhắn",
  "attachments": [{ "type": "image", "url": "https://..." }],
  "timestamp": "2026-10-29T08:00:00.000Z",
  "raw": { }
}
```

## 5. Thử không cần Facebook

Gửi một tin nhắn giả có chữ ký đúng như Meta tới backend local:

```bash
node scripts/simulate-messenger-webhook.mjs --page <PAGE_ID> --text "Shop còn size M không?"
```

(chạy trong `monolith-backend`, cần `META_APP_SECRET` trong `.env`). Kết quả `{"started":["<executionId>"]}` nghĩa là workflow đã chạy. Node gửi trả lời sẽ **lỗi** vì `test-customer` không phải người thật trên Messenger — bình thường khi giả lập; kiểm tra kết quả trong bảng `executions` / `execution_node_logs` (`npx prisma studio`).

## Giới hạn

- Chỉ trả lời được trong **24 giờ** kể từ tin nhắn cuối của khách (luật của Messenger). Ngoài cửa sổ, node báo lỗi rõ ràng.
- Chỉ gửi văn bản, tối đa 2000 ký tự. Chưa có nút bấm, ảnh, template.
- Tin nhắn trùng (Meta gửi lại) và tin do chính Page gửi (kể cả câu trả lời của bot) không kích hoạt workflow.

## Xử lý sự cố

| Triệu chứng | Kiểm tra |
|---|---|
| Verify and save thất bại | Backend đang chạy, `META_VERIFY_TOKEN` khớp, URL tunnel đúng và còn sống |
| Nhắn tin không có execution | Page đã subscribe field `messages`; người nhắn có vai trò trong App; workflow đã publish; log backend có `Invalid signature` → `META_APP_SECRET` sai |
| Node gửi lỗi "Page Access Token is invalid" | Tạo lại token, thêm connection mới và chọn lại trong node |
| Lỗi "within 24 hours" | Khách chưa nhắn trong 24 giờ qua |
