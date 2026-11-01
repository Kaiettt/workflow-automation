# Implementation Tasks: Integration Packages & App Triggers

> 🤖 Claude làm trong repo (test bằng Graph API giả). 👤 Bạn làm trên Meta / máy của bạn.
> Không commit / push khi chưa được bạn đồng ý.

## 1. Nền tảng (giữ từ lần trước)
- [x] 🤖 Hàng đợi BullMQ, `WorkflowEngine`, execution `WEBHOOK`, dọn execution kẹt
- [x] 🤖 Dedup Redis, `CheckPublishTriggersQuery`, credential nhiều field mã hoá, OAuth state Redis

## 2. Khung package (`libs/apps`)
- [x] 🤖 Hợp đồng `IntegrationPackage` / `CredentialType` / `TriggerNode` / `ActionNode`, `PackageRegistry`, `AppApiError`
- [x] 🤖 Sinh JSON Schema node (`x-webhook`, `x-loadOptions`, `x-enumLabels`, `x-placeholder`) và credential (`x-oauth2`)
- [x] 🤖 Package `webhook` (`webhook.trigger`)
- [x] 🤖 Package `messenger` (`facebookMessengerOAuth2`, `messenger.trigger`, `messenger.sendMessage`) + `MetaGraphApi` (subscriptions, subscribed_apps, OAuth, gửi tin)
- [x] 🤖 `PackageCatalogSync` khi khởi động; seed bỏ `trigger.app`, `chat.reply`, connector `messenger` (đánh dấu `isActive = false`)

## 3. Credential & OAuth2
- [x] 🤖 `CredentialVault` (libs/connector); lưu form credential OAuth2 của package; `oauth2.redirectUrl` trong `GET /api/connectors`
- [x] 🤖 `GET /api/oauth2/auth`, `GET /api/oauth2/callback` chung; gỡ Meta OAuth (`META_*` trong `.env`)
- [x] 🤖 `POST /api/node-types/:key/options/:property`

## 4. Triggers
- [x] 🤖 Migration viết lại: `workflows.active`, `webhook_endpoints`, `workflow_triggers` mới; áp vào DB dev
- [x] 🤖 `EndpointRegistrar`, `ActivationService`; `activate` / `deactivate` / `activation` / `webhooks`
- [x] 🤖 `SwitchActiveVersionCommand` từ publish và restore; publish trả `activation`
- [x] 🤖 Ingress `GET|POST /api/webhooks/:id` (mọi listener khớp đều chạy, dedup)
- [x] 🤖 Test event: `test-listen`, `GET|DELETE /api/test-events/:id`
- [x] 🤖 Kiểm credential khi publish (`INVALID_CREDENTIAL`)

## 5. Execution
- [x] 🤖 Executor sinh từ package (`PassThroughTriggerExecutor`, `PackageActionExecutor` + retry)
- [x] 🤖 Gỡ `ReplyExecutor`, `usesConversation`

## 6. Frontend
- [x] 🤖 Công tắc Active (shadcn `Switch`), badge Active ở danh sách
- [x] 🤖 `LoadOptionsField`, `WebhookUrlField` (theo endpoint), `TestEventPanel`
- [x] 🤖 Form credential OAuth2: Redirect URL, Save & connect, Reconnect
- [x] 🤖 Gỡ `AppTriggerFields`, `useAppOAuth`, `AppTriggerInfo`; `VersionDetailPage` dùng `EventTriggerInfo`

## 7. Kiểm thử & tài liệu
- [x] 🤖 Unit backend 267/267 (apps, activation, ingress, test event, OAuth2, executor)
- [x] 🤖 E2E webhook + Messenger (Graph giả) 7/7; e2e tổng 23/25 — 2 test `restore-version`, `execution-run-ui` fail ở lần publish đầu, vốn fail trên `master`
- [x] 🤖 Lint file backend đã đổi; frontend lint (0 lỗi), test 15/15, build
- [x] 🤖 E2E dùng BullMQ prefix riêng (`BULLMQ_PREFIX`) để server dev chạy cùng Redis không nhận job của test
- [ ] 👤 Thử trên giao diện và với Meta thật (chưa làm)
- [x] 🤖 `docs/setup/messenger.md`, `docs/schema/*`, `.env.example` (chỉ còn `PUBLIC_BASE_URL`)

## 8. Phần của bạn
- [ ] 👤 Meta App của bạn: thêm **Facebook Login** + **Messenger**; dán OAuth Redirect URL từ form credential vào *Valid OAuth Redirect URIs*
- [ ] 👤 `PUBLIC_BASE_URL` trỏ tới địa chỉ Meta gọi được (tunnel khi chạy local)
- [ ] 👤 Tạo credential (App ID / Secret) → Save & connect → tạo workflow → Listen for test event → Activate → nhắn thử bằng tài khoản có vai trò trong App
- [ ] 👤 *(Khi mở cho người ngoài)* App Review: `pages_messaging`, `pages_manage_metadata`, `pages_show_list`

## 9. Sau này
- [ ] Panel kéo-thả Input/Output; chuyển Sheet / Gmail / Filter / LLM vào package; Zalo OA, Telegram
