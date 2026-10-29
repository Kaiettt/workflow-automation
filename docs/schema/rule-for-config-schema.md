## Nguyên tắc chung

Mục tiêu "dễ mở rộng" = **thêm connector/node type mới chỉ cần INSERT row + viết 1 executor**, không sửa: engine, Designer UI, validation logic. Muốn vậy, schema phải tự mô tả đủ 3 thứ: *cách hiển thị*, *cách validate*, *cách engine xử lý runtime* — không được để bất kỳ thông tin nào trong 3 thứ đó nằm hard-code trong code.

---

## A. `connectors.config_schema` — chuẩn field

Ngoài JSON Schema gốc, cố định 1 bộ `x-*` key dùng xuyên suốt:

```json
{
  "type": "object",
  "properties": {
    "apiKey": {
      "type": "string",
      "title": "API Key",
      "x-secret": true,
      "x-testable": true
    },
    "workspace": {
      "type": "string",
      "title": "Workspace URL"
    }
  },
  "required": ["apiKey"]
}
```

| Field | Bắt buộc? | Vai trò |
|---|---|---|
| `type`, `properties`, `required` | Có | JSON Schema chuẩn — validate form kết nối |
| `title` | Có | Label hiển thị, tránh hard-code chuỗi tiếng Việt trong FE |
| `x-secret: true` | Nên có với mọi field OAuth token/API key | Báo cho: (1) UI render input dạng password, (2) tầng lưu trữ biết field này phải đi vào `encrypted_secret` chứ không lưu plaintext ở đâu khác |
| `x-testable: true` | Tuỳ chọn | Đánh dấu field then chốt để hàm "Test Connection" (FR-CF-04, cập nhật `last_test_status`) biết cần field nào để gọi thử API |

**Điểm mấu chốt:** `auth_type` (`OAUTH2`/`API_KEY`/`BASIC`/`NONE`) quyết định **luồng lấy secret** (redirect OAuth vs form nhập tay), còn `config_schema` chỉ mô tả **field phụ đi kèm** sau khi đã có secret (VD workspace slug). Đừng nhét cả access_token/refresh_token vào `config_schema` — 2 thứ đó luôn đi thẳng vào `connector_credentials.encrypted_secret`, không qua schema validate vì chúng do provider trả về, không do user gõ.

---

## B. `node_type_definitions` — 3 schema, áp dụng nhất quán bộ `x-*` sau

```json
{
  "config_schema": {
    "type": "object",
    "properties": {
      "credential_id": {
        "type": "string",
        "title": "Tài khoản",
        "x-refType": "credential",
        "x-connectorKey": "gmail"
      },
      "to": {
        "type": "string",
        "title": "Người nhận",
        "x-allowExpression": true
      },
      "subject": {
        "type": "string",
        "title": "Tiêu đề",
        "x-allowExpression": true
      }
    },
    "required": ["credential_id", "to", "subject"]
  },
  "input_schema": null,
  "output_schema": {
    "type": "object",
    "properties": {
      "message_id": { "type": "string" },
      "delivered": { "type": "boolean" }
    }
  }
}
```

| `x-*` field | Đặt ở đâu | Engine/UI dùng để làm gì |
|---|---|---|
| `x-refType: "credential"` | `config_schema` | UI render credential picker; **engine dùng để biết field nào cần gửi qua `CredentialVault.decrypt()`** trước khi truyền vào executor — tránh executor tự phải biết field nào là credential_id |
| `x-connectorKey` | `config_schema`, field kiểu `x-refType: credential` | Filter danh sách credential đúng connector (không cho chọn nhầm credential Slack cho node Gmail) — validate được cả ở DB lẫn UI |
| `x-allowExpression: true` | `config_schema` | Engine (`resolveConfig()` trong `libs/execution/src/domain/expression`) chỉ resolve `{{...}}` ở field có cờ này; field không đánh dấu thì **bỏ qua resolve** để tránh cost + tránh resolve nhầm chuỗi tình cờ chứa `{{`. Cú pháp và quy tắc giữ kiểu: xem mục D |
| `x-connectorKeyFrom: "<field>"` | `config_schema`, field kiểu `x-refType: credential` | Dùng thay `x-connectorKey` khi một node phục vụ nhiều connector: connector của credential lấy theo giá trị đang chọn ở field `<field>` (vd. `provider`). UI chỉ liệt kê credential của connector đó, và **xoá credential đã chọn khi field `<field>` đổi**. Engine kiểm tra credential thuộc đúng connector qua `expectedConnectorKey(rawConfig)` của executor, nên field `<field>` không được là biểu thức |
| `x-propertyOrder: ["a", "b", ...]` | `config_schema` (ở gốc schema, cạnh `properties`) | Thứ tự hiển thị các field trong form. Bắt buộc phải khai báo vì **JSONB của Postgres không giữ thứ tự key** (sắp lại theo độ dài), nên thứ tự viết trong `properties` bị mất. Field không được liệt kê hiện sau cùng |
| `x-multiline: true` | `config_schema` | UI render textarea thay vì ô một dòng (prompt dài) |
| `x-placeholderByField: { field, values }` | `config_schema` | UI hiện gợi ý (placeholder) lấy từ `values[<giá trị hiện tại của field>]` — vd. gợi ý tên model theo provider |
| `x-credentialInput: "form"` | `config_schema`, field có `x-connectorKey` | Credential được **nhập vào form** sinh từ `connectors.config_schema` (vd. Page ID + Page Access Token của Messenger) thay vì nút đăng nhập OAuth. Không có hint này, `x-connectorKey` render nút OAuth (Google) |
| `x-display: "webhookUrl"` | `config_schema` (ở gốc schema) | Properties Panel hiện URL webhook (chỉ đọc, có nút copy) của node trigger, lấy từ `GET /api/workflows/:id/triggers` sau khi publish |
| `description` | `config_schema`, field kiểu chuỗi | Gợi ý riêng hiện dưới ô nhập, thay cho gợi ý biểu thức chung |
| `default` | `config_schema` (JSON Schema chuẩn) | Engine điền giá trị này khi config **thiếu** key (`applySchemaDefaults`); UI điền sẵn khi thêm node lên canvas. Default có thể là biểu thức, vd. Gmail `to` = `{{$json.email}}` |
| `x-secret: true` | `config_schema` (hiếm khi cần, vì secret thường đã nằm ở `credential_id`) | Field này bị **mask khi ghi vào `execution_node_logs.input`** — bổ sung lớp bảo vệ nếu 1 node nào đó lỡ cần nhập secret trực tiếp (không qua credential) |
| `x-dynamicSource: { operation }` | `config_schema` | Field cần load option runtime (list channel, list sheet) — UI gọi `GET /connectors/:credentialId/dynamic-options?operation=...`, executor implement thêm 1 method `listOptions()` ngoài `execute()` |

---

## C. Ràng buộc engine cần enforce dựa trên schema (không phải chỉ UI)

Đây là phần hay bị bỏ sót — schema không chỉ phục vụ UI, **engine cũng phải đọc nó** để hành xử đúng, nếu không thì "extensible" chỉ là ảo:

1. **Trước khi resolve template**: engine chỉ chạy `resolveConfig()` lên các field có `x-allowExpression: true` (đọc từ `config_schema`, không phải quét mù toàn bộ config) → tránh false-positive, tăng hiệu năng.
2. **Trước khi gọi executor**: engine tự lookup mọi field `x-refType: "credential"`, gọi `vault.decrypt()`, rồi mới truyền `resolvedConfig` cho executor — nghĩa là **executor không bao giờ nhận `credential_id` thô**, chỉ nhận token đã giải mã. Việc này tách khỏi câu hỏi trước (chỗ `gmail-send.executor.ts` mình viết credential_id truyền thẳng vào executor) — nếu áp dụng `x-refType`, executor sẽ gọn hơn vì không tự gọi vault nữa, logic decrypt chuyển hết lên `execute-node.ts`.
3. **Trước khi ghi log**: engine mask mọi field có `x-secret: true` thành `"***"` trong `input` trước khi `prisma.executionNodeLog.create()`.
4. **Validate config trước khi cho publish** (FR-WD-06): dùng thẳng `ajv` (hoặc lib JSON Schema tương đương) chạy `config_schema` lên `node.data.config` — không viết validator tay riêng cho từng node type.

---

## D. Hợp đồng item & cú pháp biểu thức (engine)

Dữ liệu giữa các node luôn là `Item[]`, `Item = { json, pairedItem? }`. Mỗi executor tự khai báo cách chạy:

| `runMode` | Engine làm gì | Node hiện có |
|---|---|---|
| `per_item` | Gọi `executeItem` một lần cho **mỗi** item; resolve config theo item đó; gán `pairedItem`. Trả `null`/`[]` → bỏ item | Filter, Gmail |
| `once` | Resolve config một lần, gọi `execute` với toàn bộ `Item[]` | Manual Trigger, Google Sheet, Aggregate |

Output của một node **chỉ chứa kết quả của chính node đó** (trừ Filter trả nguyên item); dữ liệu node trước lấy bằng `$node[...]`.

Biểu thức (không phải JavaScript, chỉ truy cập dữ liệu):

| Biểu thức | Ý nghĩa |
|---|---|
| `{{$json.name}}`, `{{$json.a.b[0]}}`, `{{$json["full name"]}}` | field của item hiện tại |
| `{{$node["Read Customers"].json.email}}` | item của node đó **ghép cặp** với item hiện tại (đi ngược `pairedItem`) |
| `{{$node["Read Customers"].all}}` | mảng `json` của mọi item output của node đó |
| `{{name}}` | tương thích ngược, bằng `{{$json.name}}` |

- Cả field chỉ là **một** biểu thức → giữ nguyên kiểu (number, object, array...); thiếu → `null`. Biểu thức lẫn trong chuỗi → nối chuỗi (thiếu → rỗng, object → JSON).
- `$node["Tên"]` tra theo **tên hiển thị** (`data.name`). Tên không tồn tại, trùng, hoặc node chưa chạy → node `FAILED` kèm lý do. Đi qua node không ghép cặp (vd. Aggregate) thì `.json` báo lỗi, dùng `.all`.
- Node `per_item` lỗi ở item thứ *k* → engine ghi `{ total_items, processed, failed_at_index }` vào output log.
- `expectedConnectorKey(rawConfig)` của executor cho engine biết connector mà credential phải thuộc về; field dùng để suy ra nó không được là biểu thức.

---

## E. Checklist khi thêm 1 node type mới (kết quả cuối cùng của toàn bộ thiết kế trên)

1. INSERT `node_type_definitions` với `config_schema`/`output_schema` đầy đủ `x-*` hint.
2. Viết 1 class implement `INodeExecutor` (như `GmailSendExecutor`) — **chỉ chứa business logic gọi API**, không tự lo decrypt/resolve/log.
3. `registry.register('integration.xxx.yyy', new XxxExecutor(...))`.
4. Không đụng: `execute-node.ts`, `template-resolver.ts`, Designer form component.

→ Đây chính là ranh giới rõ ràng giữa "phần mở rộng bằng data" (bước 1) và "phần bắt buộc phải code" (bước 2) mà câu hỏi trước bạn đặt ra — schema thiết kế đúng sẽ giữ engine ổn định vĩnh viễn, chỉ có catalog và executor tăng theo số connector.

Bạn muốn mình cập nhật `execute-node.ts` để áp dụng `x-refType`/`x-secret`/`x-allowExpression` thật sự (thay vì chỉ mô tả), hay viết phần Ajv validate trước publish?