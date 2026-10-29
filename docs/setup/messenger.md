# Facebook Messenger: cài đặt và dùng thử

Mọi thứ cấu hình trong giao diện FlowPilot, giống n8n: bạn dùng **Meta App của chính mình**, nhập App ID / App Secret vào credential, bấm Connect, rồi bật công tắc **Active**. FlowPilot tự đăng ký webhook với Meta. Server chỉ cần biết địa chỉ public của nó (`PUBLIC_BASE_URL`).

> Spec: `specs/chat-trigger/`.

## 1. Server: địa chỉ public (một lần)

Meta chỉ gọi được HTTPS public. Khi dev:

```bash
cloudflared tunnel --url http://localhost:8081
```

→ URL `https://<tên>.trycloudflare.com` (đổi mỗi lần chạy lại; muốn cố định thì dùng named tunnel + tên miền riêng). Ghi vào `monolith-backend/.env` rồi khởi động lại backend:

```
PUBLIC_BASE_URL=https://<tên>.trycloudflare.com
```

Không còn biến `META_*` nào trong `.env`.

## 2. Meta App của bạn

1. <https://developers.facebook.com> → **Create App** → loại **Business** (hoặc use case "Engage with customers on Messenger").
2. Thêm hai sản phẩm: **Facebook Login** và **Messenger**.
3. **App settings → Basic**: copy **App ID** và **App Secret**.

Không cần tự cấu hình Webhooks trong dashboard: FlowPilot đăng ký khi bạn bật workflow.

## 3. Credential "Facebook Messenger account"

1. Trong Designer, thêm node **Messenger Trigger** → **+ Add connection**.
2. Nhập tên, **App ID**, **App Secret**.
3. Copy **OAuth Redirect URL** trong form (`{PUBLIC_BASE_URL}/api/oauth2/callback`), dán vào Meta App: **Facebook Login → Settings → Valid OAuth Redirect URIs** → Save.
4. Bấm **Save & connect** → đăng nhập Facebook, chọn các Page muốn dùng, cho phép quyền `pages_show_list`, `pages_messaging`, `pages_manage_metadata`.
5. Pop-up đóng, credential được chọn. Thêm Page sau này: chọn credential → **Reconnect**.

FlowPilot lưu token dài hạn của bạn và Page token (không hết hạn) đã mã hoá trong credential.

## 4. Dựng workflow

```
Messenger Trigger (Page, Keywords tuỳ chọn)
  → LLM (prompt: {{$json.text}})
  → Messenger Send Message (Page, Recipient ID: {{$node["Messenger Trigger"].json.sender_id}}, Text: {{$json.text}})
```

- **Page**: chọn từ danh sách Page của credential (nút ↻ để tải lại).
- **Keywords**: để trống = mọi tin. Có từ khoá = chỉ tin chứa một trong các từ (không phân biệt hoa thường, dấu).
- Nhiều workflow cùng Page đều chạy nếu cùng khớp (như n8n). Muốn tách nhánh thì dùng Filter.

**Listen for test event**: bấm trong node Messenger Trigger, nhắn thử cho Page trong 2 phút → thấy JSON tin nhắn (`sender_id`, `text`, `page_id`…) để viết biểu thức. Không tạo execution. Dùng cấu hình bản nháp, chưa cần publish.

## 5. Publish và bật

1. **Publish** (publish không tự bật lắng nghe).
2. Bật công tắc **Active** ở header Designer. FlowPilot:
   - gọi `POST /{app-id}/subscriptions` (object `page`, field `messages`, callback `{PUBLIC_BASE_URL}/api/webhooks/<id>`, verify token sinh ngẫu nhiên). Meta gọi lại callback để kiểm verify token;
   - gọi `POST /{page-id}/subscribed_apps` cho Page đã chọn.
3. Lỗi (sai App Secret, chưa thêm Messenger, callback không truy cập được…) → công tắc giữ Tắt và hiện lý do Meta trả về.
4. Đang Active mà Publish lại → tự chuyển sang version mới; nếu không chuyển được, workflow tự tắt và báo lý do.
5. Tắt workflow cuối cùng dùng credential → FlowPilot gỡ subscription.

## 6. Thử thật

- Khi App còn ở chế độ Development, chỉ tài khoản có vai trò trong App (Admin / Developer / Tester) nhắn tới Page mới được Meta gửi webhook.
- Nhắn cho Page → xem execution trong trang Versions (Run UI) / danh sách execution.
- Messenger chỉ cho trả lời trong 24 giờ kể từ tin cuối của khách.

## 7. Khi mở cho người ngoài

Gửi **App Review** cho `pages_messaging`, `pages_manage_metadata`, `pages_show_list` và chuyển App sang Live. Đây là việc của người sở hữu Meta App.

## Sự cố thường gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| Pop-up báo "redirect_uri is not whitelisted" | Chưa dán OAuth Redirect URL vào Valid OAuth Redirect URIs, hoặc `PUBLIC_BASE_URL` đổi (tunnel mới) |
| Bật Active báo lỗi callback | `PUBLIC_BASE_URL` không truy cập được từ internet, hoặc backend chưa khởi động lại sau khi đổi |
| Bật được nhưng không có execution | Tài khoản nhắn tin không có vai trò trong App (App đang Development), hoặc tin không chứa từ khoá |
| Send Message báo "Page … is not connected" | Page chưa được cấp khi Connect → chọn credential → **Reconnect** và chọn thêm Page |
