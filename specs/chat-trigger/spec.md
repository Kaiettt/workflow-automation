# Feature Specification: Integration Packages & App Triggers (kiểu n8n)

> **Phụ thuộc:** `execution-item-model`, `llm-node` (đã xong).
> **Thay thế** hai bản trước: (1) node cứng `trigger.webhook` / `trigger.messenger.message` / `integration.messenger.send`; (2) node chung `trigger.app` + node "Reply" thần kỳ + Meta App cấu hình trong `.env`. Bản (2) bị loại vì người dùng không tự cấu hình được trong giao diện và không giống cách n8n làm: app nào cũng đi qua một khuôn node chung, credential nhập trên UI, workflow có công tắc **Active** và tự đăng ký webhook.

## 1. Bối cảnh & Vấn đề

Workflow cần **tự chạy khi có sự kiện từ ứng dụng bên ngoài** (hệ thống khác gọi webhook, khách nhắn Facebook Page; sau này Zalo, Telegram, Shopify…) và **gửi dữ liệu lại** cho app đó.

Những gì người dùng (developer / người vận hành tự host) cần, theo mô hình n8n:
1. **Tự cấu hình mọi thứ trong UI.** Không có bước "sửa `.env` rồi khởi động lại server" cho từng app. Ai có Meta App của riêng mình thì nhập App ID / App Secret vào credential, bấm Connect là xong.
2. **Mỗi app là một bộ node riêng** (Messenger Trigger, Messenger Send Message…) nhưng dựng trên **một khung chung**: thêm app không phải sửa core, seed hay giao diện.
3. **Bật/tắt workflow bằng công tắc Active.** Bật thì FlowPilot tự đăng ký webhook với app bên ngoài; tắt thì tự gỡ. Publish không còn ngầm bật lắng nghe.
4. **Thử bằng sự kiện thật trước khi bật:** bấm "Listen for test event", nhắn thử một tin, thấy ngay JSON nhận được để viết biểu thức cho node sau.

## 2. Giải pháp

| Thành phần | Mô tả |
|---|---|
| **Integration package** | `libs/apps/src/<app>`: khai báo **credential type**, **trigger node** (field + vòng đời webhook `checkExists` / `create` / `delete` / `handle`) và **action node** (field + `execute`). Thêm app = thêm package + một dòng trong danh sách package. |
| **Đồng bộ catalog khi khởi động** | Node type và credential type của các package được upsert vào `node_type_definitions` / `connectors` lúc server khởi động. Không sửa seed cho từng app. |
| **Credential type + OAuth2 chung** | Form credential sinh từ khai báo field. Credential OAuth2: người dùng nhập App ID / App Secret của mình, form hiện **OAuth Redirect URL** để copy, bấm **Connect** mở pop-up; callback chung `GET /api/oauth2/callback` lưu token vào chính credential đó. |
| **Webhook endpoint riêng** | Mỗi trigger có URL `/api/webhooks/<id>`. Phạm vi do package quyết: **theo node** (Webhook) hoặc **theo credential** (Messenger: một Meta App = một callback URL). URL không đổi qua các lần publish. |
| **Công tắc Active** | `POST /api/workflows/:id/activate` / `deactivate`. Chỉ workflow đang Active nhận sự kiện, và chỉ bằng version publish hiện hành. |
| **Dynamic options** | `POST /api/node-types/:key/options/:property` (kiểu `loadOptions` của n8n), vd. danh sách Page của credential Facebook. |
| **Listen for test event** | Từ trigger node trong editor: chờ tối đa 2 phút một sự kiện thật theo cấu hình **bản nháp**, hiện JSON, không tạo execution. |

Package v1: **Webhook** và **Facebook Messenger**. Node cũ `trigger.app`, `chat.reply` bị thay.

### Ví dụ

**(a) Chatbot AI cho Page**
```
Messenger Trigger (Page "Shop ABC")
  → LLM (prompt: {{$json.text}})
  → Messenger Send Message (Page "Shop ABC",
       Recipient ID: {{$node["Messenger Trigger"].json.sender_id}},
       Text: {{$json.text}})
```

**(b) Flow riêng cho từ khoá, chạy song song với (a)**
```
Messenger Trigger (Page "Shop ABC", Keywords: "giá, bảng giá") → Messenger Send Message ("Bảng giá: https://…")
```
Khách nhắn "cho mình xin bảng giá" → **cả (a) và (b) đều chạy** (như n8n: mọi trigger khớp đều chạy). Muốn (a) không trả lời câu hỏi giá thì thêm Filter vào (a). Bộ lọc từ khoá chỉ để bỏ qua tin không liên quan.

**(c) Webhook**
```
Webhook (POST https://flow.example.com/api/webhooks/9b1c…) → Filter → Gmail
```

## 3. Hiện trạng & Khoảng trống

- **Giữ lại:** hàng đợi BullMQ + `WorkflowEngine`, execution `WEBHOOK` chạy nền, dedup Redis, kiểm chữ ký Meta (HMAC trên body gốc), gửi tin Graph API + map lỗi Graph, credential nhiều field mã hoá, OAuth state Redis dùng một lần, `CheckPublishTriggersQuery`.
- **Phải đổi:** `AppDefinition` → `IntegrationPackage`; cổng `/api/webhooks/:app/:token?` → `/api/webhooks/:id`; node `trigger.app` + `chat.reply` → node riêng từng package; định tuyến độc quyền theo từ khoá + `TRIGGER_CONFLICT` → mọi trigger khớp đều chạy; listener sinh ra khi publish → sinh ra khi **Active**; Meta OAuth đọc `.env` → OAuth2 chung với App ID / Secret trong credential.
- **Chưa có:** cột `workflows.active`, bảng `webhook_endpoints`, đồng bộ catalog, OAuth2 chung, `loadOptions`, test event, công tắc Active trên UI.

## 4. Phạm vi

### Trong phạm vi
- Khung package trong `libs/apps` + registry; đồng bộ catalog khi khởi động.
- Credential type: form sinh từ field; OAuth2 chung (authorize, callback, lưu token vào credential, Reconnect).
- Webhook endpoint theo node / theo credential; ingress chung `GET|POST /api/webhooks/:id`; dedup.
- Activate / Deactivate; publish khi đang Active chuyển listener sang version mới; đăng ký lỗi thì workflow tắt và báo lỗi.
- `loadOptions`; Listen for test event.
- Package **Webhook**: node `webhook.trigger`, URL riêng mỗi node, dedup theo `Idempotency-Key`.
- Package **Facebook Messenger**: credential `facebookMessengerOAuth2`, node `messenger.trigger` (Page + Keywords tuỳ chọn), node `messenger.sendMessage` (Page, Recipient ID, Text).
- Gỡ `trigger.app`, `chat.reply`, connector `messenger` cũ, Meta OAuth theo `.env`.

### Ngoài phạm vi
- Panel kéo-thả Input/Output để map dữ liệu.
- Chuyển node có sẵn (Google Sheet, Gmail, Filter, LLM, Aggregate) vào package.
- Zalo OA, Telegram (package tiếp theo, cùng khuôn).
- URL test riêng (`/webhook-test/` như n8n), "Respond to webhook", tin nhắn ảnh / nút / template.
- App Review của Meta (việc của người sở hữu Meta App khi mở cho người ngoài).

## 5. Trải nghiệm người dùng

### Credential "Facebook Messenger account" (OAuth2)

| Field | Ghi chú |
|---|---|
| Name | Nhãn hiển thị |
| App ID, App Secret | Lấy trong Meta App của người dùng (App Secret ẩn) |
| OAuth Redirect URL | Chỉ đọc + Copy (`{PUBLIC_BASE_URL}/api/oauth2/callback`), dán vào *Facebook Login → Valid OAuth Redirect URIs* |

Nút **Save & connect** → lưu credential → pop-up Facebook → chọn Page → cho phép → pop-up đóng, credential được chọn trong node. Credential đã có: nút **Reconnect** (cấp thêm Page, làm mới token).

### Webhook (node)
- Ô **Webhook URL** chỉ đọc + Copy, có ngay khi thêm node (không cần publish). URL chỉ nhận sự kiện khi workflow Active, hoặc trong lúc Listen for test event.

### Messenger Trigger (node)
| Field | Control |
|---|---|
| Credential | Picker credential `facebookMessengerOAuth2` + thêm mới |
| Page | Select, options tải từ credential (`loadOptions`) |
| Keywords | Text, tuỳ chọn, phân tách bằng dấu phẩy. Trống = mọi tin |

### Messenger Send Message (node)
| Field | Control |
|---|---|
| Credential, Page | Như trên |
| Recipient ID | Biểu thức, mặc định `{{$node["Messenger Trigger"].json.sender_id}}` |
| Text | Biểu thức, nhiều dòng |

### Listen for test event (mọi trigger node có webhook)
- Nút **Listen for test event** → "Waiting for an event…" kèm đếm ngược, nút **Stop**.
- Có sự kiện → hiện JSON nhận được. Hết 2 phút → "No event received".
- Dùng cấu hình **bản nháp** (chưa cần publish), không tạo execution.

### Công tắc Active (header Designer)
- Bật: cần đã publish. Lỗi (chưa publish, credential chưa kết nối, Meta từ chối đăng ký…) → công tắc giữ Tắt, hiện thông báo lỗi.
- Đang Active mà Publish → listener chuyển sang version mới; nếu đăng ký thất bại, workflow tự tắt và màn hình publish báo lý do.
- Danh sách workflow hiện nhãn **Active**.

## 6. API

| Endpoint | Auth | Mô tả |
|---|---|---|
| `GET /api/node-types` | — | (đã có) gồm cả node của package |
| `GET /api/connectors` | JWT | (đã có) gồm credential type của package; OAuth2 kèm `oauth2.redirectUrl` |
| `POST /api/connectors/:key/credentials` | JWT | (đã có) lưu field credential, cho cả credential type OAuth2 của package |
| `GET /api/oauth2/auth?credentialId=` | JWT (chủ credential) | `{ url }` authorize cho pop-up |
| `GET /api/oauth2/callback?code&state` | state | Đổi code lấy token, lưu vào credential; trang pop-up `postMessage` rồi đóng |
| `POST /api/node-types/:key/options/:property` | JWT | `{ credentialId }` → `[{ value, label }]` |
| `GET /api/workflows/:id/webhooks` | JWT (chủ) | URL webhook của các trigger theo node trong bản nháp (tạo endpoint nếu chưa có) |
| `GET /api/workflows/:id/activation` | JWT (chủ) | `{ active, versionId }` |
| `POST /api/workflows/:id/activate` | JWT (chủ) | Bật; `400 { message }` nếu không bật được |
| `POST /api/workflows/:id/deactivate` | JWT (chủ) | Tắt |
| `POST /api/workflows/:id/nodes/:nodeId/test-listen` | JWT (chủ) | `{ listenId, expiresAt }` |
| `GET /api/test-events/:listenId` | JWT (người tạo) | `{ status: waiting \| received \| expired, event?, expiresAt }` |
| `DELETE /api/test-events/:listenId` | JWT (người tạo) | Dừng chờ |
| `GET \| POST /api/webhooks/:id` | do package (chữ ký / URL bí mật) | Nhận sự kiện. Mã trả về do package: Webhook `202 { started, ignored }`, Messenger `200`; sai chữ ký `401`; endpoint theo node không ai nghe `404` |
| `POST /api/workflows/:id/versions` | JWT | (đã có) kèm `activation: { active, error? }` khi workflow đang Active |

## 7. Quy tắc nghiệp vụ

1. **Chỉ workflow Active nhận sự kiện**, bằng version publish hiện hành. Publish không tự bật.
2. **Bật thất bại thì không bật gì cả:** không ghi listener, endpoint vừa đăng ký trong lần đó được gỡ lại.
3. **Mọi listener khớp đều chạy** (mỗi listener một execution). Messenger Trigger khớp khi đúng Page và (không có từ khoá, hoặc nội dung chứa một từ khoá). So khớp không phân biệt hoa thường, dấu tiếng Việt, khoảng trắng thừa.
4. **Phạm vi endpoint:** Webhook — một URL cho mỗi node (giữ qua publish, deactivate/activate). Messenger — một URL cho mỗi credential (một Meta App chỉ có một callback cho object `page`). Endpoint chỉ bị gỡ đăng ký khi không còn listener nào.
5. **Bí mật lấy từ credential / endpoint, không từ `.env`:** App Secret (kiểm chữ ký, app access token) nằm trong credential; verify token sinh ngẫu nhiên khi tạo endpoint và lưu trong dữ liệu endpoint. `.env` chỉ còn `PUBLIC_BASE_URL`.
6. **Chống trùng:** cùng endpoint + id sự kiện chỉ xử lý một lần trong 24 giờ (Webhook: header `Idempotency-Key`; Messenger: `mid`).
7. Bỏ qua echo (tin Page tự gửi, gồm cả tin bot trả lời), delivery, read.
8. **Credential theo chủ workflow:** node chỉ dùng được credential của chủ workflow và đúng credential type; endpoint theo credential thuộc về chủ credential.
9. **Test event** không tạo execution, chỉ nhận sự kiện khớp đầu tiên, hết hạn sau 120 giây; endpoint được đăng ký tạm cho lần thử sẽ được gỡ khi hết hạn nếu không có listener thật.
10. Token, secret không vào log; Messenger chỉ cho trả lời trong 24 giờ kể từ tin cuối của khách (lỗi rõ, không thử lại).

## 8. Tiêu chí chấp nhận

- Thêm package mới chỉ cần thư mục `libs/apps/src/<app>` + một dòng đăng ký (kiểm bằng cấu trúc: ingress, activation, catalog sync, UI không có nhánh theo tên app).
- Khởi động server → node `webhook.trigger`, `messenger.trigger`, `messenger.sendMessage` và connector `facebookMessengerOAuth2` có trong catalog mà seed không nhắc tới.
- Không còn biến `META_*` nào được đọc từ `.env`.
- Webhook: URL có ngay trong editor; chưa Active → `404`; Activate → `POST` trả `202`, execution chạy nền; publish lại giữ URL.
- Messenger: tạo credential bằng App ID / Secret, Connect (Graph giả) lưu token + Page; `loadOptions` trả danh sách Page; Activate gọi `POST /{app-id}/subscriptions` và `POST /{page-id}/subscribed_apps`; handshake đúng verify token → `200`; tin có chữ ký đúng chạy **mọi** workflow khớp; Send Message gửi bằng Page token.
- Activate thất bại (Graph trả lỗi) → `400`, workflow vẫn tắt, không có listener.
- Deactivate listener cuối của endpoint → gọi `delete` (gỡ subscription).
- Listen for test event nhận JSON của tin thử, không tạo execution.
