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

Thêm vào nền tảng một **node LLM** để người dùng đưa AI vào workflow. Node được thiết kế là một **primitive tổng quát** ("một prompt vào, một câu trả lời ra"): hệ thống không áp đặt cách dùng, người dùng tự quyết định dùng AI để làm gì.

Để node LLM hoạt động đúng trong luồng nhiều bước, engine thực thi phải được làm lại trước. Công việc vì vậy chia thành hai spec thực hiện theo thứ tự:

1. `execution-item-model`: mô hình dữ liệu theo item, biểu thức tham chiếu dữ liệu giữa các node.
2. `llm-node`: node LLM, nhiều nhà cung cấp, API key do người dùng tự cung cấp.

Tài liệu đặc tả nằm ở `specs/<tên-tính-năng>/` gồm `spec.md`, `design.md`, `task.md`.

---

## 3. Nội dung công việc đã thực hiện

### 3.1. Spec 1: Mô hình item và biểu thức cho engine thực thi

**Mô hình item.** Dữ liệu giữa các node là danh sách `Item = { json, pairedItem? }`. Mỗi executor khai báo `runMode`:
- `per_item`: engine chạy node một lần cho mỗi item (Gmail, Filter, LLM).
- `once`: chạy một lần cho cả danh sách (Manual Trigger, Aggregate).

`NodeRunner` chịu trách nhiệm lấy credential một lần cho mỗi node, kiểm tra loại connector, giải biểu thức cho từng item, gán `pairedItem`, và ghi tóm tắt `{total_items, processed, failed_at_index}` khi một item lỗi.

**Biểu thức (không dùng `eval`).** Cú pháp: `{{$json.x}}`, `{{$node["Tên node"].json.x}}`, `{{$node["Tên node"].all}}`, và dạng cũ `{{name}}`. Chỉ các trường có `x-allowExpression: true` mới được giải biểu thức. Biểu thức đơn giữ nguyên kiểu dữ liệu. Giá trị `default` trong schema được áp dụng tự động. Node được tham chiếu bằng **tên node**; cảnh báo hiện ra khi hai node trùng tên.

**Di chuyển node cũ và node mới.**
- Chuyển Filter, Gmail, Google Sheet, Manual Trigger sang mô hình mới. Gmail có thêm trường `to` (mặc định `{{$json.email}}` để workflow cũ vẫn chạy) và loại bỏ ký tự xuống dòng để chống chèn header.
- Thêm node **Aggregate** (gom các item thành một).
- Log node dùng định dạng `Item[]` mới; không di chuyển log cũ.

### 3.2. Spec 2: Node LLM

**Node** `ai.llm.generate`, nhóm mới `AI` (enum `NodeCategory.AI`, có migration).

| Trường | Ý nghĩa |
|---|---|
| `provider` | `anthropic`, `openai` hoặc `gemini` |
| `credential_id` | API key của người dùng, chỉ lọc theo provider đã chọn |
| `model` | Tên model, người dùng tự nhập |
| `system_prompt` | Tùy chọn: vai trò, giọng văn |
| `prompt` | Yêu cầu cụ thể, hỗ trợ biểu thức |
| `output_format` | `text` hoặc `json` |
| `max_tokens` | Mặc định 1024, người dùng tự đặt |
| `temperature` | Tùy chọn, chỉ gửi khi có giá trị |
| `max_items` | Mặc định 50; trần của nền tảng 100 |

Đầu ra của node: `{ text, data?, model, usage }`; `data` chỉ có khi `output_format = json` và đã được parse.

**Kiến trúc nhà cung cấp.** Cổng `LlmProvider` cùng ba adapter: Anthropic (`@anthropic-ai/sdk`, dùng stream), OpenAI (`chat.completions`, `max_completion_tokens`), Gemini (`@google/genai`). Có `LlmProviderRegistry` chọn adapter theo provider.

**Độ tin cậy.**
- Thử lại tối đa 2 lần (chờ 1 giây, 2 giây) cho các lỗi 408/429/5xx và hết thời gian; timeout mỗi lần gọi 60 giây.
- Xử lý từ chối (refusal) và cắt cụt do `max_tokens`.
- Chế độ JSON, và `temperature` chỉ gửi khi người dùng đặt (một số model mới từ chối tham số này).

**Giới hạn số item (trần 100).** Execution hiện chạy đồng bộ trong request HTTP, mỗi lần gọi LLM mất khoảng 5 giây, nên 100 item ≈ 8 phút còn 500 item ≈ 40 phút. Trần chỉnh được bằng biến môi trường `LLM_MAX_ITEMS`. Cách giải quyết gốc là chạy execution nền bằng BullMQ, đã ghi vào mục "ngoài phạm vi" của spec.

**API key.**
- Lưu mã hóa AES-256-GCM, khóa là `ENCRYPTION_KEY` (64 ký tự hex).
- API không bao giờ trả secret về client.
- Routes mới: `POST/GET /api/connectors/:connectorKey/credentials`.
- Thông báo lỗi được lọc để không lộ key (`sk-ant-`, `sk-`, `AIza`).

**Catalog.** `seed-mvp.ts` cập nhật schema catalog mỗi lần chạy (3 connector LLM, node Aggregate, node LLM). Schema dùng chung ở `prisma/mvp-node-schemas.ts`. Thêm gợi ý `x-propertyOrder` vì JSONB của Postgres làm đảo thứ tự khóa, và `x-placeholderByField`. Quy ước đã ghi trong `docs/schema/rule-for-config-schema.md`.

### 3.3. Giao diện

- Sidebar nhóm node theo danh mục (có nhóm AI); node mới đặt tên không trùng (`LLM`, `LLM 2`...).
- `PropertiesPanel` tách thành `ConfigField` và các trường con (`EnumField`, `TextField`, `NumberField`, `CredentialField`); form sinh từ JSON Schema và các gợi ý `x-*`, theo đúng thứ tự schema khai báo.
- Chọn provider rồi chọn credential tương ứng; hộp thoại **+ Add API key** (ô nhập ẩn ký tự); đổi provider thì credential cũ bị xóa; lỗi tải danh sách key hiện đúng thông báo.
- Trang version hiển thị "N vào → M ra" cho từng node.
- Thêm xóa node: nút **Delete node** ở panel và phím `Backspace`/`Delete` trên canvas (xóa kèm các đường nối).
- Thêm các thành phần shadcn/ui: `input`, `label`, `select`, `textarea`.

### 3.4. Sửa lỗi phát hiện trong tuần

| Lỗi | Cách xử lý |
|---|---|
| `node-library` xếp node AI vào nhóm LOGIC | Thêm case `AI` và nhánh `never` bắt buộc đủ case, có test |
| JSONB làm lộn thứ tự trường trong form | Thêm `x-propertyOrder` |
| `system_prompt` để trống bị lưu thành chuỗi rỗng | Bỏ qua khi trống (test phát hiện) |
| Một node thiếu `key` làm hỏng tra cứu catalog của cả lần chạy | Lọc key không hợp lệ trước khi tra |
| Test mã hóa `encryption.util.spec.ts` thỉnh thoảng lỗi (~6%) | Lật ký tự cuối một cách xác định; chạy 60 lần không lỗi |
| Tiêu đề và nội dung email tiếng Việt bị lỗi font | Mã hóa tiêu đề theo RFC 2047, thân thư có dấu gửi bằng base64, có test |
| Không xóa được node trên canvas | Thêm nút xóa và phím `Delete` |

---

## 4. Kiểm thử và kết quả

- **Kiểm thử đơn vị:** 192 test pass (biểu thức, run-state, các executor, adapter LLM, handler thực thi, mapper, credential).
- **Kiểm thử e2e:** 11 test pass (`execution-item-model`, `llm-node`); test tự tạo và dọn dữ liệu.
- **Lint và kiểm tra kiểu:** ESLint và `tsc` sạch.
- **Kiểm thử trên giao diện thật:** dùng Playwright + Edge với backend, frontend và Postgres thật; 42/42 kiểm tra đạt (kéo node, form, thêm key, đổi provider, thứ tự trường, lưu cấu hình, tên trùng, lỗi tải danh sách key).
- **Chạy thật qua Gmail:** người dùng kết nối Google OAuth và nhận được email gửi từ workflow Manual Trigger → LLM → Send Gmail. Quá trình này phát hiện lỗi font tiêu đề ở mục 3.4.

---

## 5. Hạn chế và việc chưa làm

- Chưa có kiểm thử tự động cho giao diện (frontend chưa có test runner).
- Gợi ý tên model mẫu của OpenAI (`gpt-4o-mini`) và Gemini (`gemini-2.0-flash`) chưa kiểm tra còn mới hay không.
- Chưa chạy workflow thật với node Google Sheet Read Rows.
- `docs/schema/schema.md` chưa cập nhật giá trị enum `AI`.
- Execution vẫn chạy đồng bộ nên trần LLM là 100 item.
- Mỗi item tạo một client SDK mới (chấp nhận được hiện tại, chưa tối ưu).
- Cấu hình Google dùng tên biến `google-Client-Id` và `google-Client-secret` (không theo quy ước viết hoa); `.env.example` chưa có các biến Google.

---

## 6. Kế hoạch tuần tới

1. Chạy execution nền bằng BullMQ (Redis), sau đó nâng `LLM_MAX_ITEMS`.
2. Bổ sung kiểm thử tự động cho giao diện.
3. Cập nhật `.env.example` (biến Google) và `docs/schema/schema.md`.
4. Chạy thật workflow với Google Sheet và các nhà cung cấp LLM còn lại.
