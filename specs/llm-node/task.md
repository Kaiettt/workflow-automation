# Implementation Tasks: LLM Node

> Xây trên `specs/execution-item-model` (đã hoàn tất).

## 1. Database (Prisma)

- [x] Thêm `AI` vào enum `NodeCategory` trong `schema.prisma`
- [x] Migration `20261017000000_add_ai_node_category` (`ALTER TYPE "NodeCategory" ADD VALUE 'AI'`) — viết tay vì DB dev tạo bằng `db push` (không có `_prisma_migrations`), `migrate dev` sẽ đòi reset và mất dữ liệu; câu lệnh tương đương đã chạy trực tiếp lên DB dev
- [x] Seed MVP: upsert 3 connector `anthropic`, `openai`, `gemini` (`API_KEY`, `api_key` `x-secret`)
- [x] Seed MVP: upsert node `ai.llm.generate` (category `AI`, `config_schema` trong `prisma/mvp-node-schemas.ts`)
- [x] Chạy seed nhiều lần — không lỗi
- [x] Cập nhật `docs/schema/rule-for-config-schema.md` (`x-connectorKeyFrom`, `x-multiline`, `x-placeholderByField`)
- [ ] Cập nhật `docs/schema/schema.md` (enum `AI`)

---

## 2. Backend

### 2.1. Node Library
- [x] Thêm `AI` vào domain enum `NodeCategory`

### 2.2. Execution — Engine
- [x] `IPerItemExecutor.maxItems?(rawConfig)`; `NodeRunner` kiểm tra trước vòng lặp (trước cả khi lấy credential)
- [x] `sanitizeErrorText`: che `sk-ant-...`, `sk-...`, `AIza...`

### 2.3. Execution — Domain / Application
- [x] `NodeKeys.AI_LLM_GENERATE`, `ConnectorKeys.ANTHROPIC | OPENAI | GEMINI`, `LlmLimits`
- [x] Port `LlmProvider`, `LlmGenerateRequest`, `LlmGenerateResult`, `LlmProviderError`
- [x] `LlmProviderRegistry`
- [x] `LlmGenerateExecutor`: `parseConfig` (coerce số, default, prompt/system_prompt nhận kết quả biểu thức không phải chuỗi), `expectedConnectorKey`, `maxItems`
- [x] `LlmGenerateExecutor.executeItem`: gọi adapter, retry 1s → 2s, output `{ text, data?, model, usage }`, parse JSON (bỏ code fence)

### 2.4. Execution — Infrastructure
- [x] Cài `@anthropic-ai/sdk`, `openai`, `@google/genai`
- [x] `AnthropicLlmAdapter` (stream + `finalMessage`, JSON qua chỉ dẫn system prompt, `refusal`, hết `max_tokens` khi chưa có chữ)
- [x] `OpenAiLlmAdapter` (`max_completion_tokens`, `response_format: json_object`, `refusal`)
- [x] `GeminiLlmAdapter` (`responseMimeType`, `promptFeedback.blockReason`, `AbortSignal.timeout`)
- [x] Mọi adapter: timeout 60s, tắt retry của SDK, map lỗi → `LlmProviderError`, trả usage

### 2.5. Connector module
- [x] `CreateApiKeyCredentialCommand` + handler
- [x] `ListCredentialsQuery` + handler
- [x] `CreateApiKeyCredentialDto`, `CredentialResponseDto`, `CredentialSummary`
- [x] `ConnectorsController`: `POST` / `GET /api/connectors/:connectorKey/credentials`
- [x] `ConnectorCredentialRepository.findByOwnerAndConnector`

### 2.6. Module assembly & cấu hình
- [x] `ExecutionModule`: adapters, `LLM_PROVIDERS`, registry, executor (factory đọc `LLM_MAX_ITEMS`), thêm vào `NODE_EXECUTORS`
- [x] `ConnectorModule`: đăng ký handler mới
- [x] `.env.example`: `LLM_MAX_ITEMS=100` (hạ từ 500 sau review: execution chạy đồng bộ), ghi chú `ENCRYPTION_KEY` (trước đó chưa được ghi, trong khi lưu credential cần nó)
- [x] `tsconfig.json`: alias `@app/node-library`; `package.json`: `moduleNameMapper` cho jest unit

---

## 3. Frontend

- [x] `npx shadcn@latest add input textarea select label` (sửa import `cn` do CLI sinh sai thành `@/lib/utils`)
- [x] Thêm `'AI'` vào `category`; palette nhóm theo category (có nhóm AI); icon `sparkles` (`NodeIcon`)
- [x] Backend: `NodeTypeDefinitionMapper` map `AI` và báo lỗi biên dịch khi có category chưa map (test: `node-type-definition.mapper.spec.ts`)
- [x] `x-propertyOrder` trong schema các node + `orderedProperties` ở UI
- [x] `credential.api.ts`, `credential.service.ts`, `useCredentials.ts`
- [x] Tách `PropertiesPanel` → `config-fields/` (`CredentialField`, `EnumField`, `TextField`, `NumberField`, `FieldShell`) dùng shadcn
- [x] `NumberField` lưu `number`; `handleConfigChange` nhận `unknown`
- [x] `CredentialPicker` hỗ trợ `x-connectorKeyFrom`; đổi provider → xoá credential đã chọn
- [x] `AddApiKeyDialog` (input password), tự chọn credential vừa tạo
- [x] `TextField` render `Textarea` khi `x-multiline`
- [x] Gợi ý model theo provider (`x-placeholderByField` trong schema, không hardcode trong UI)
- [x] Thử giao diện thật (Edge + backend + frontend + Postgres, thao tác như người dùng, 40 kiểm tra): kéo node, chọn provider, thêm API key, đổi provider xoá key, số lưu đúng kiểu, tên node trùng, thứ tự field. Bắt được 2 lỗi mà test khác không thấy, đã sửa: node LLM bị xếp vào nhóm LOGIC (mapper `default: LOGIC`) và thứ tự field bị xáo (JSONB không giữ thứ tự key → thêm `x-propertyOrder`)

---

## 4. Kiểm thử & Đảm bảo chất lượng (QA & Verification)

- [x] Unit `LlmGenerateExecutor` với fake provider (36 test)
- [x] Unit engine: 4 ví dụ (a)–(d); vượt `max_items` và trần `LLM_MAX_ITEMS`; credential sai provider; lỗi giữa chừng; không lộ API key (`start-execution.llm.spec.ts`)
- [x] Unit 3 adapter với client giả + lớp lỗi thật của SDK (37 test)
- [x] Unit connector handlers (8 test)
- [x] E2E `llm-node.e2e-spec.ts`: lưu key qua HTTP → mã hoá trong Postgres → giải mã khi chạy; chỉ thay lời gọi vendor
- [x] Hồi quy: MVP `Manual → Sheet → Filter → Gmail`, e2e cũ
- [x] `npm run lint` + `npm test` backend, `npm run build` frontend — 0 lỗi
- [ ] Chạy thật ví dụ (a) và (c) với API key thật của ít nhất 1 provider (chưa làm: cần API key thật; adapter mới được kiểm bằng client giả, chưa gọi vendor thật)
- [ ] Test tự động cho frontend (dự án chưa có test runner; kịch bản thử giao diện chạy bằng Playwright tạm, không nằm trong repo)
