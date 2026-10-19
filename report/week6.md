# BÁO CÁO TIẾN ĐỘ TUẦN 06

## 1. Thông tin chung

- **Tên đề tài:** CrabFlowPilot – Nền tảng thiết kế và tự động hóa quy trình (Workflow Automation)
- **Học kỳ:** Học kỳ 1, năm học 2026–2027
- **Tuần báo cáo:** Tuần 06
- **Thời gian báo cáo:** 12/10/2026 – 18/10/2026
- **Sinh viên thực hiện:** Nguyễn Anh Kiệt - MSSV: 23110246, Nguyễn Văn Hiếu - MSSV: 23110214
- **Giảng viên hướng dẫn:** Nguyễn Hữu Trung
- **Mã nguồn dự án:** `workflow-automation`
- **Nhánh làm việc:** `feat/llm-workflow`
- **Ngày chốt số liệu:** 17/10/2026

---

## 2. Mục tiêu của tuần

Thêm vào nền tảng một **node LLM** để người dùng đưa AI vào workflow. Node được thiết kế như một **primitive tổng quát** — *một prompt vào, một kết quả ra* — FlowPilot không áp đặt cách dùng, người thiết kế workflow tự viết prompt.

Để node LLM hoạt động đúng trong luồng nhiều bước, engine thực thi phải được làm lại trước. Engine cũ không có khái niệm "item", mỗi node tự lặp và tự xử lý template riêng, không có cách tham chiếu dữ liệu của node cách xa. Công việc vì vậy chia thành hai spec thực hiện theo thứ tự:

1. **`execution-item-model`** — mô hình item thống nhất, bộ resolve biểu thức chung, paired item.
2. **`llm-node`** — node LLM, ba nhà cung cấp, API key do người dùng tự cung cấp.

Tài liệu đặc tả nằm ở `specs/<tên-tính-năng>/` gồm `spec.md`, `design.md`, `task.md`.

---

## 3. Nội dung công việc đã thực hiện

### 3.1. Spec 1 — Mô hình item và biểu thức cho engine thực thi

#### Vấn đề cần giải quyết

Engine cũ có nhiều điểm yếu: không có kiểu item chung (Manual Trigger trả `null`, Gmail trả object đếm, mỗi node tự quyết), mỗi node tự lặp và tự thay template, không thể tham chiếu dữ liệu của node xa hơn một bước. Việc thêm node LLM lộ rõ vấn đề — nếu giữ engine cũ, LLM phải tự quản lý `per_item / once` thay vì chỉ làm đúng việc của nó.

#### Hợp đồng item mới

Dữ liệu giữa mọi node từ nay luôn là `Item[]`:

```
Item = { json: object, pairedItem?: number }
```

`pairedItem` là chỉ số của item input đã sinh ra item output này — engine tự gán, dùng để tra ngược dữ liệu qua nhiều node.

Mỗi executor khai báo **run mode**:

| Run mode | Engine làm gì |
|---|---|
| `per_item` | Gọi executor **một lần cho mỗi item**; resolve config theo item đó; gán `pairedItem`. Ví dụ: Filter, Gmail, LLM. |
| `once` | Gọi executor **một lần cho toàn bộ danh sách**; resolve config theo item đầu tiên (hoặc `{}` nếu không có item). Ví dụ: Manual Trigger, Google Sheet, Aggregate. |

Node `per_item` nhận 0 item → không gọi lần nào, output `[]`, trạng thái `SUCCESS`. Item lỗi → dừng node, engine ghi `{ total_items, processed, failed_at_index }` vào log — áp dụng cho mọi node `per_item` mà không cần executor tự xử lý.

#### Biểu thức (không dùng `eval`)

Biểu thức nằm trong `{{ ... }}`, chỉ resolve ở field có `x-allowExpression: true` trong `config_schema`. Không phải JavaScript — chỉ là đường dẫn truy cập dữ liệu.

| Cú pháp | Ý nghĩa |
|---|---|
| `{{$json.name}}` | Field `name` của item hiện tại |
| `{{$json.tags[0]}}` | Phần tử mảng |
| `{{$json["full name"]}}` | Key có dấu cách |
| `{{$node["Read Customers"].json.email}}` | Item của node đó tương ứng với item hiện tại (qua paired item) |
| `{{$node["Read Customers"].all}}` | Mảng json của mọi item output của node đó |
| `{{name}}` | Tương thích ngược — tương đương `{{$json.name}}` |

Biểu thức đứng một mình giữ nguyên kiểu dữ liệu (number, boolean, array). Biểu thức lẫn trong chuỗi → nối thành chuỗi. Cú pháp sai → node `FAILED` với thông báo chỉ rõ tên field.

#### Các node được chuyển và thêm mới

| Node | Thay đổi |
|---|---|
| `trigger.manual` | `once`, output `[{ json: {} }]` |
| `integration.google_sheet.readRows` | `once`, mỗi dòng sheet là 1 item |
| `logic.filter` | `per_item`, giữ hoặc bỏ item; field là đường dẫn (không phải biểu thức) |
| `integration.gmail.send` | `per_item`, thêm field `to` (mặc định `{{$json.email}}`), subject/body là biểu thức; output `{ to, status, message_id }` |
| `data.aggregate` | **Mới**, `once` — gom mọi item thành 1 item `{ [field]: [...] }` |

Tương thích ngược với workflow đã publish được đảm bảo: `{{name}}` hiểu là `{{$json.name}}`, Gmail thiếu `to` dùng mặc định `{{$json.email}}`.

---

### 3.2. Spec 2 — Node LLM

#### Thiết kế primitive

Node `ai.llm.generate`, nhóm mới `AI` (enum `NodeCategory.AI`, có migration). Node **không biết** dữ liệu đến từ đâu hay có bao nhiêu dòng — lặp theo item, chèn dữ liệu, gộp danh sách đều do engine lo.

#### Config và output

| Field | Bắt buộc | Mặc định | Biểu thức |
|---|---|---|---|
| `provider` (`anthropic` / `openai` / `gemini`) | có | | không |
| `credential_id` | có | | không |
| `model` | có | | không |
| `system_prompt` | không | | **có** |
| `prompt` | có | | **có** |
| `output_format` (`text` / `json`) | không | `text` | không |
| `max_tokens` | không | 1024 | không |
| `temperature` | không | mặc định provider | không |
| `max_items` | không | 50 | không |

Mỗi item input sinh đúng 1 item output: `{ text, model, usage }`. Khi `output_format: json`, thêm `data` = kết quả đã parse.

#### Kiến trúc provider

Cổng `LlmProvider` cùng ba adapter:
- **Anthropic** — `@anthropic-ai/sdk`, dùng streaming
- **OpenAI** — `chat.completions`, `max_completion_tokens`
- **Gemini** — `@google/genai`

`LlmProviderRegistry` chọn adapter theo provider. Retry tối đa 2 lần (chờ 1 s, 2 s) cho lỗi 429 / 5xx / timeout; timeout mỗi lần gọi 60 s. Lỗi 400 / 401 không retry.

#### Giới hạn số item

Execution chạy đồng bộ trong request HTTP và gọi LLM tuần tự (~5 s mỗi lần). Với 100 item ≈ 8 phút; 500 item ≈ 40 phút — request treo quá lâu. Vì vậy có trần `LLM_MAX_ITEMS` (biến môi trường, mặc định 100); giới hạn hiệu lực = `min(max_items, LLM_MAX_ITEMS)`. Vượt → node `FAILED` trước khi gọi LLM lần nào. Trần sẽ được nâng khi execution chạy nền (BullMQ).

#### API key và bảo mật

- Lưu mã hóa AES-256-GCM, khóa `ENCRYPTION_KEY` (64 ký tự hex).
- Routes mới: `POST/GET /api/connectors/:connectorKey/credentials`.
- API không bao giờ trả secret về client; thông báo lỗi lọc pattern `sk-ant-`, `sk-`, `AIza`.

#### Catalog và seed

`seed-mvp.ts` cập nhật schema catalog mỗi lần chạy (3 connector LLM, node Aggregate, node LLM). Schema dùng chung ở `prisma/mvp-node-schemas.ts`. Thêm gợi ý `x-propertyOrder` (JSONB Postgres đảo thứ tự khóa) và `x-placeholderByField`. Quy ước ghi trong `docs/schema/rule-for-config-schema.md`.

---

### 3.3. Giao diện

- Sidebar nhóm node theo danh mục, có nhóm **AI**; node mới đặt tên không trùng (`LLM`, `LLM 2`...).
- `PropertiesPanel` tách thành `ConfigField` và các trường con (`EnumField`, `TextField`, `NumberField`, `CredentialField`); form sinh từ JSON Schema và gợi ý `x-*`, theo đúng thứ tự khai báo.
- Chọn provider → chỉ hiện credential của provider đó; hộp thoại **+ Thêm API key** (ô nhập ẩn ký tự); đổi provider → xóa credential cũ; lỗi tải danh sách key hiện đúng thông báo.
- Trang version hiển thị "N vào → M ra" cho từng node.
- Xóa node: nút **Delete node** ở panel và phím `Backspace`/`Delete` trên canvas (xóa kèm các đường nối).
- Thêm các thành phần shadcn/ui: `input`, `label`, `select`, `textarea`.

---

### 3.4. Sửa lỗi phát hiện trong tuần

| Lỗi | Cách xử lý |
|---|---|
| `node-library` xếp node AI vào nhóm LOGIC | Thêm case `AI` và nhánh `never` bắt buộc đủ case, có test |
| JSONB làm lộn thứ tự trường trong form | Thêm `x-propertyOrder` |
| `system_prompt` để trống bị lưu thành chuỗi rỗng | Bỏ qua khi trống (test phát hiện) |
| Một node thiếu `key` làm hỏng tra cứu catalog của cả lần chạy | Lọc key không hợp lệ trước khi tra |
| Test mã hóa `encryption.util.spec.ts` thỉnh thoảng lỗi (~6%) | Lật ký tự cuối một cách xác định; chạy 60 lần không lỗi |
| Tiêu đề và nội dung email tiếng Việt bị lỗi font | Mã hóa tiêu đề theo RFC 2047, thân thư gửi bằng base64, có test |
| Không xóa được node trên canvas | Thêm nút xóa và phím `Delete` |

---

## 4. Kiểm thử và kết quả

Tuần này là lần đầu tiên dự án có kiểm thử tự động cho backend. Trước đó toàn bộ phần `monolith-backend` chưa có test nào; mọi xác nhận đều dựa vào chạy tay. Việc viết test được thực hiện song song với việc xây dựng tính năng, theo nguyên tắc mỗi module mới phải có test đi kèm trước khi được xem là hoàn thành.

- **Kiểm thử đơn vị:** 192 test pass – bao phủ biểu thức, run-state, các executor (Filter, Gmail, Google Sheet, Aggregate, LLM), ba adapter LLM (Anthropic / OpenAI / Gemini), handler thực thi, mapper node-library, credential handler, và encryption util.
- **Kiểm thử e2e:** 11 test pass – chạy qua HTTP thật với NestJS TestingModule và Postgres thật; mỗi suite tự tạo và dọn dữ liệu; kiểm tra luồng `execution-item-model` và `llm-node` bao gồm cả lưu / liệt kê API key.
- **Lint và kiểm tra kiểu:** ESLint và `tsc` sạch.
- **Kiểm thử trên giao diện thật:** dùng Playwright + Edge với backend, frontend và Postgres thật; 42/42 kiểm tra đạt (kéo node, form, thêm key, đổi provider, thứ tự trường, lưu cấu hình, tên trùng, lỗi tải danh sách key).
- **Chạy thật qua Gmail:** người dùng kết nối Google OAuth và nhận được email gửi từ workflow Manual Trigger → LLM → Send Gmail. Quá trình này phát hiện lỗi font tiêu đề ở mục 3.4.

---

## 5. Hạn chế và việc chưa làm

- Chưa có kiểm thử tự động cho giao diện (frontend chưa có test runner).
- Gợi ý tên model mẫu của OpenAI (`gpt-4o-mini`) và Gemini (`gemini-2.0-flash`) chưa kiểm tra còn mới hay không.
- Chưa chạy workflow thật với node Google Sheet Read Rows.
- Execution vẫn chạy đồng bộ nên trần LLM là 100 item.
- Mỗi item tạo một client SDK mới (chấp nhận được hiện tại, chưa tối ưu).
- Cấu hình Google dùng tên biến `google-Client-Id` và `google-Client-secret` (không theo quy ước viết hoa); `.env.example` chưa có các biến Google.

---

## 6. Kế hoạch tuần tới

1. Chạy execution nền bằng BullMQ (Redis), sau đó nâng `LLM_MAX_ITEMS`.
2. Bổ sung kiểm thử tự động cho giao diện.
4. Chạy thật workflow với Google Sheet và các nhà cung cấp LLM còn lại.
