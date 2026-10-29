# Implementation Tasks: Chat Trigger (Messenger & Zalo OA)

> Xây trên `specs/execution-item-model` và `specs/llm-node` (đã hoàn tất).

## Ký hiệu người làm

| Ký hiệu | Ai làm | Ý nghĩa |
|---|---|---|
| 🤖 | **Claude** | Code, migration, seed, test, tài liệu — làm được hoàn toàn trong repo, kiểm bằng test và payload giả |
| 👤 | **Bạn** | Cần tài khoản, quyền quản trị, giấy tờ, tên miền, hoặc thao tác trên trang của Meta / Zalo — Claude **không thể** làm thay |
| 🤝 | **Cùng làm** | Bạn cung cấp giá trị / thao tác, Claude viết code hoặc hướng dẫn từng bước |

**Thứ tự đề xuất:** P1 (không cần tài khoản ngoài, test được ngay bằng `curl`) → P2 Messenger → P3 Zalo.
Việc 👤 của P2/P3 nên **bắt đầu song song ngay từ đầu** vì xét duyệt của Meta / Zalo mất từ vài ngày đến vài tuần.

---

## 0. Chuẩn bị chung

- [ ] 👤 **Chọn cách có URL public HTTPS** để Meta/Zalo gọi vào máy dev. Máy đã có `cloudflared`:
  - Thử nhanh: `cloudflared tunnel --url http://localhost:8081` → URL `*.trycloudflare.com` (đổi mỗi lần chạy — **đủ cho Messenger, không đủ cho Zalo**).
  - Ổn định (bắt buộc cho Zalo vì phải xác thực tên miền): cần **một tên miền riêng** trỏ về Cloudflare → tạo *named tunnel* (`cloudflared tunnel create`, `cloudflared tunnel route dns`).
- [ ] 🤝 Claude viết `docs/setup/public-tunnel.md` hướng dẫn từng lệnh; bạn chạy và báo lại URL.
- [ ] 👤 Đặt `PUBLIC_BASE_URL` trong `.env` của bạn (không commit).

---

## P1. Nền tảng: Webhook + chạy execution nền

> Toàn bộ P1 Claude làm được, không cần bạn setup gì ngoài Redis đang chạy sẵn (`docker-compose up -d`).

### P1.1. Database
- [x] 🤖 Enum `TriggerChannel`, model `WorkflowTrigger` trong `schema.prisma`
- [x] 🤖 Migration `20261029000000_add_workflow_triggers` viết tay (bảng + partial unique index `WHERE is_active`), đã chạy lên DB dev bằng `prisma db execute`; `prisma migrate diff` xác nhận DB khớp schema
- [x] 🤖 Seed node `trigger.webhook` (`config_schema` có hint `x-display: "webhookUrl"`)
- [x] 🤖 Cập nhật `docs/schema/schema.md`

### P1.2. Execution engine
- [x] 🤖 Tách `WorkflowEngine` khỏi `StartExecutionHandler`; manual giữ nguyên hành vi đồng bộ (test cũ không đổi kịch bản)
- [x] 🤖 `NodeRunner`: `actorId` → `credentialOwnerId` (luôn là chủ workflow)
- [ ] ~~Bỏ qua credential cho node TRIGGER~~ → chuyển sang P2 (trigger webhook không có credential, chỉ trigger kênh chat cần)
- [x] 🤖 `createExecution` nhận `triggerType`, `triggeredById` (nullable), `context` (`{ triggerItems }`)
- [x] 🤖 `WebhookTriggerExecutor` (chỉ `trigger.webhook`; Messenger / Zalo thêm ở P2/P3)
- [x] 🤖 Cài `bullmq`, `@nestjs/bullmq`; điền `execution-queue.module.ts`, `execution.processor.ts`; `EnqueueExecutionCommand`
- [x] 🤖 Dọn execution kẹt `RUNNING` khi khởi động (`failStaleExecutions`)
- [x] 🤖 `.env.example`: `PUBLIC_BASE_URL`, `EXECUTION_CONCURRENCY`, `EXECUTION_STALE_MINUTES`

### P1.3. Module `libs/triggers`
- [x] 🤖 Domain: `WorkflowTrigger`, `findTriggerNodes`, `planTriggers`, `buildWebhookItem` (ẩn header `authorization`, `cookie`, `x-api-key`), repository port
- [ ] ~~`SignatureVerifier` khung~~ → làm luôn ở P2 cùng thuật toán Meta (khung rỗng không có người dùng)
- [x] 🤖 `WorkflowPublishedEvent` từ `PublishWorkflowHandler` và nhánh `PUBLISH_THEN_RESTORE`
- [x] 🤖 `SyncWorkflowTriggersHandler` (giữ token webhook giữa các version)
- [x] 🤖 `WebhooksController` `POST /api/webhooks/w/:token` → `202 { executionId }`; `rawBody: true` trong `main.ts`; giới hạn JSON 1 MB
- [x] 🤖 Redis dedup — dùng cho header `Idempotency-Key` của webhook chung (P2/P3 dùng lại cho `message_id`)
- [x] 🤖 `GET /api/workflows/:id/triggers` (chỉ chủ workflow)

### P1.4. Frontend
- [x] 🤖 `WebhookUrlField` (readonly + copy) trong Properties Panel, `trigger.api.ts`, `trigger.service.ts`, `useWorkflowTriggers` (tự kiểm tra lại mỗi 5s đến khi node có URL)
- [x] 🤖 `VersionDetailPage`: version có `trigger.webhook` hiện URL (`WebhookTriggerInfo`) thay nút Run; version cũ báo không nhận request
- [ ] ~~Cột nguồn chạy, tự làm mới khi có execution `RUNNING`~~ → chưa làm: frontend chưa có màn hình danh sách execution để gắn vào

### P1.5. Kiểm thử
- [x] 🤖 Unit (`webhook-execution.spec.ts`, `webhook-triggers.spec.ts`, 23 test): enqueue / processor, payload vào node đầu, credential theo chủ workflow, definition lỗi → FAILED, version bị xoá → FAILED, sync giữ token, tắt listener cũ, dedup, URL, quyền xem
- [x] 🤖 E2E `webhook-trigger.e2e-spec.ts` (HTTP + Postgres + Redis + BullMQ thật): POST → 202 → execution `WEBHOOK` hoàn tất nền, header `Authorization` không vào log; publish lại → URL không đổi và chạy version mới; `Idempotency-Key` trùng → 1 lần chạy; token sai → 404
- [x] 🤖 Hồi quy: unit backend 234/234; e2e 19/21 — 2 test fail (`restore-version`, `execution-run-ui`) **fail y hệt trên `master`** (node filter không có config bị validate publish chặn), không do P1
- [x] 🤖 Lint các file đổi (backend), `npm run lint` + `npm test` (9/9) + `npm run build` frontend
- [ ] 👤 Thử bằng tay: tạo workflow `Webhook Trigger → Gmail`, publish, `curl` vào URL, thấy email đến

---

## P2. Messenger

### P2.1. Setup phía Meta — 👤 **Bạn phải tự làm**

> Claude sẽ viết `docs/setup/messenger.md` với ảnh chụp vị trí từng nút nếu cần, nhưng **mọi thao tác dưới đây phải do chủ tài khoản thực hiện**.

- [ ] 👤 Có tài khoản Facebook cá nhân và **một Facebook Page để thử** (tạo Page mới riêng cho test, không dùng Page thật của shop)
- [ ] 👤 Đăng ký **Meta for Developers** (developers.facebook.com), xác minh tài khoản developer
- [ ] 👤 Tạo **App** loại Business, thêm sản phẩm **Messenger**
- [ ] 👤 Lấy **App Secret** (App settings → Basic) → điền `META_APP_SECRET` trong `.env`
- [ ] 👤 Tự đặt một chuỗi ngẫu nhiên làm `META_VERIFY_TOKEN` trong `.env`
- [ ] 👤 Trong Messenger settings: liên kết Page → **Generate Page Access Token** → lưu lại (sẽ dán vào FlowPilot ở bước kết nối Page)
- [ ] 👤 Cấu hình **Webhook**: Callback URL = `{PUBLIC_BASE_URL}/api/webhooks/messenger`, Verify token = `META_VERIFY_TOKEN` → Verify and save *(backend + tunnel phải đang chạy)*
- [ ] 👤 Subscribe Page vào webhook, chọn field **`messages`** (không chọn `message_echoes` cho v1)
- [ ] 👤 Kiểm `META_GRAPH_VERSION` trong `.env` khớp version API hiện hành hiển thị trên dashboard
- [ ] 👤 **Chế độ Development:** chỉ người có vai trò trong App (Admin/Developer/Tester) nhắn tin mới kích hoạt được → thêm tài khoản Facebook dùng để test làm Tester
- [ ] 👤 *(Chỉ khi muốn khách thật dùng được)* Gửi **App Review** xin quyền `pages_messaging` (cần video demo, chính sách quyền riêng tư, có thể cần xác minh doanh nghiệp). **Không bắt buộc để hoàn thành spec này.**

### P2.2. Code — 🤖 Claude làm
- [ ] 🤖 Seed connector `messenger`, node `trigger.messenger.message`, `integration.messenger.send`
- [ ] 🤖 `SignatureVerifier.verifyMeta` (HMAC-SHA256, `timingSafeEqual`)
- [ ] 🤖 `GET /api/webhooks/messenger` (verify challenge), `POST /api/webhooks/messenger`
- [ ] 🤖 `MessengerEventMapper` (lọc echo / delivery / read; tách nhiều tin → nhiều execution)
- [ ] 🤖 `MetaGraphClient.sendText`, `MessengerSendExecutor` (retry 429/5xx, lỗi 24h không retry, text ≤ 2000)
- [ ] 🤖 `sanitizeErrorText`: pattern `EAA...`
- [ ] 🤖 Rule validate `CHANNEL_ALREADY_BOUND` khi publish
- [ ] 🤖 Credential nhiều field (`CreateCredentialCommand`, DTO, `displayHint`) — giữ tương thích body `{ name, api_key }`
- [ ] 🤖 Frontend: `AddCredentialDialog` sinh form từ `configSchema`; picker hiện `name — page_id`; cảnh báo `sender_id` sau LLM
- [ ] 🤖 Script `scripts/simulate-messenger-webhook.ts`: ký payload mẫu bằng `META_APP_SECRET` và POST vào local — **test trọn luồng không cần Meta**
- [ ] 🤖 Unit + e2e theo `design.md` mục 6
- [ ] 🤖 `docs/setup/messenger.md`

### P2.3. Chạy thật — 🤝 Cùng làm
- [ ] 👤 Chạy backend + tunnel, verify webhook thành công trên dashboard Meta
- [ ] 👤 Trong FlowPilot: kết nối Page (dán Page ID + Page Access Token), tạo workflow ví dụ (a) `Messenger Trigger → LLM → Messenger Send`, publish
- [ ] 👤 Dùng tài khoản Tester nhắn tin vào Page → nhận câu trả lời
- [ ] 🤝 Bạn gửi log / ảnh lỗi nếu có; Claude chẩn đoán và sửa

---

## P3. Zalo OA

### P3.1. Setup phía Zalo — 👤 **Bạn phải tự làm**

> Zalo khắt khe hơn Meta: OA phải được **xác thực**, tên miền webhook phải được **xác minh**. Nên bắt đầu sớm.

- [ ] 👤 Có tài khoản Zalo, tạo **Zalo Official Account** (oa.zalo.me)
- [ ] 👤 **Xác thực OA** (thường cần giấy phép kinh doanh / giấy tờ tổ chức; OA chưa xác thực bị giới hạn tính năng gửi tin). *Đây là bước có thể chặn tiến độ — kiểm tra điều kiện sớm.*
- [ ] 👤 Đăng ký **Zalo for Developers** (developers.zalo.me), tạo **Ứng dụng**, liên kết với OA
- [ ] 👤 Lấy **App ID**, **App Secret**, **OA Secret Key** → điền `ZALO_APP_ID`, `ZALO_APP_SECRET`, `ZALO_OA_SECRET_KEY`
- [ ] 👤 **Xác minh tên miền** của `PUBLIC_BASE_URL` (Zalo yêu cầu đặt file / meta tag xác minh) → **cần named tunnel với tên miền riêng** (mục 0)
- [ ] 👤 Cấu hình **Webhook URL** = `{PUBLIC_BASE_URL}/api/webhooks/zalo`, bật sự kiện **người dùng gửi tin nhắn văn bản**
- [ ] 👤 Cấp quyền cho ứng dụng truy cập OA → lấy **Access Token** và **Refresh Token** của OA (qua luồng cấp quyền hoặc công cụ API Explorer của Zalo)
- [ ] 👤 Dùng một tài khoản Zalo khác **quan tâm (follow) OA** để test

### P3.2. Xác minh tài liệu — 🤝 Cùng làm
> Tài liệu Zalo thay đổi theo phiên bản; spec này **chưa khẳng định** các chi tiết dưới đây. Claude đọc tài liệu công khai, bạn đối chiếu với những gì thấy trên trang quản trị.

- [ ] 🤝 Công thức chữ ký `X-ZEvent-Signature` (thứ tự ghép chuỗi, khoá nào)
- [ ] 🤝 Endpoint + header gửi tin tư vấn (Open API v3)
- [ ] 🤝 Endpoint làm mới token, thời hạn access token / refresh token
- [ ] 🤝 Giới hạn cửa sổ gửi tin tư vấn sau tin nhắn cuối của người dùng
- [ ] 🤖 Ghi kết quả vào mục "Ghi chú xác minh" cuối file này

### P3.3. Code — 🤖 Claude làm
- [ ] 🤖 Seed connector `zalo_oa`, node `trigger.zalo.message`, `integration.zalo.send`
- [ ] 🤖 `SignatureVerifier.verifyZalo` + chống replay theo timestamp
- [ ] 🤖 `POST /api/webhooks/zalo`, `ZaloEventMapper` (`user_send_text`)
- [ ] 🤖 `ZaloOaClient.sendText`, `ZaloSendExecutor`
- [ ] 🤖 `ZaloTokenService`: refresh trước hạn, ghi đè cả 2 token, khoá Redis chống refresh song song
- [ ] 🤖 `ConnectorCredentialRepository.updateSecret` + `CredentialRefreshPort`
- [ ] 🤖 `sanitizeErrorText`: pattern token Zalo
- [ ] 🤖 Script `scripts/simulate-zalo-webhook.ts`
- [ ] 🤖 Unit + e2e theo `design.md` mục 6
- [ ] 🤖 `docs/setup/zalo-oa.md`

### P3.4. Chạy thật — 🤝 Cùng làm
- [ ] 👤 Kết nối OA trong FlowPilot (OA ID + 2 token), tạo workflow ví dụ (c) `Zalo Trigger → Zalo Send`, publish
- [ ] 👤 Nhắn tin từ tài khoản đã follow OA → nhận trả lời tự động
- [ ] 👤 Để credential qua ít nhất một lần hết hạn access token → xác nhận tự refresh vẫn gửi được

---

## 4. Tổng kết phân công

| Hạng mục | 🤖 Claude | 👤 Bạn |
|---|---|---|
| Hàng đợi, engine, webhook chung (P1) | Toàn bộ | Chạy thử 1 lần bằng `curl` |
| Code Messenger / Zalo | Toàn bộ, test bằng payload giả có chữ ký | — |
| Tài khoản, App, Page, OA | Viết hướng dẫn | **Tạo và quản trị** |
| Secret (`META_APP_SECRET`, token Page, khoá Zalo) | Không bao giờ thấy / nhập | **Tự điền vào `.env` và form** |
| Tên miền + tunnel ổn định | Viết hướng dẫn lệnh | **Mua / trỏ tên miền, chạy tunnel** |
| Xác thực OA, App Review Meta | — | **Nộp hồ sơ** |
| Kiểm thử với tin nhắn thật | Chẩn đoán log, sửa lỗi | **Nhắn tin, gửi lại kết quả** |

## 5. Rủi ro

- **Xác thực Zalo OA** có thể không làm được với tài khoản sinh viên / cá nhân → P3 dừng ở mức "code xong, test bằng payload giả". P1 và P2 không phụ thuộc.
- **Messenger ở chế độ Development** chỉ nhận tin từ Tester — đủ để demo, không đủ cho người dùng thật nếu không qua App Review.
- **Tunnel tạm `trycloudflare.com`** đổi URL mỗi lần chạy → phải cấu hình lại webhook trên Meta mỗi lần.
- Webhook public là bề mặt tấn công mới → chữ ký, giới hạn body, dedup là bắt buộc, không phải tuỳ chọn.

## 6. Ghi chú xác minh (điền khi làm P3.2)

_(trống)_
