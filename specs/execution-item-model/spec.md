# Feature Specification: Execution Item Model & Expression Resolver

## 1. Bối cảnh & Vấn đề (Context & Problem Statement)

Engine thực thi hiện tại (`StartExecutionHandler`) chỉ làm một việc: lấy `output` của node trước, đưa nguyên làm `input` của node sau. Ngoài ra không có quy ước nào:

- **Không có khái niệm "item".** Mỗi node tự quyết input / output là gì: Manual Trigger trả `null`, Sheet trả mảng object, Filter nhận mảng, Gmail nhận mảng `{name, email}` và trả một object đếm `{sent_count, ...}`.
- **Mỗi node tự lặp.** Filter tự `.filter()` cả mảng; Gmail tự `for` qua từng người nhận.
- **Mỗi node tự xử lý template.** Gmail tự thay `{{name}}`, `{{email}}` bằng regex; không node nào khác có template.
- **Chỉ đọc được node ngay trước.** Không có cách lấy dữ liệu của node xa hơn. Trong khi `PropertiesPanel` lại gợi ý placeholder `{{nodeId.output}}` mà engine không hỗ trợ.
- **Quy ước `x-allowExpression` trong `rule-for-config-schema.md` chưa được engine thực hiện** — engine không đọc `config_schema`.

**Hệ quả:** mỗi node mới phải tự lo lặp, template, ghép dữ liệu — node sau càng làm lại nhiều hơn, và node không thể dùng đa dụng. Việc thêm **LLM node** (spec `llm-node`) lộ rõ vấn đề: nếu giữ engine như cũ, LLM phải tự có `mode: per_item / once` và `output_field` — tức là tự xử lý luồng thay vì chỉ làm đúng việc của nó.

**Giải pháp thống nhất:** chuyển ba trách nhiệm chung xuống engine, mọi node cùng hưởng:
1. **Hợp đồng item** — dữ liệu giữa các node luôn là danh sách item; engine tự chạy node theo từng item.
2. **Bộ resolve biểu thức chung** — `{{$json.x}}`, `{{$node["Tên node"].json.x}}`; engine resolve trước khi gọi executor.
3. **Liên kết item (paired item)** — mỗi item output nhớ nó sinh ra từ item input nào, để tra ngược dữ liệu của node trước đó.

Chuyển Filter, Gmail, Google Sheet, Manual Trigger sang hợp đồng mới; thêm node **Aggregate** để gộp nhiều item thành một.

Spec này là **tiền đề của `llm-node`**.

---

## 2. Hiện trạng hệ thống & Phân tích khoảng trống (Current State & Gap Analysis)

### 2.1. Engine (`libs/execution`)
- **Đã có sẵn:**
  - `getExecutionOrder`: đồ thị phải là một chuỗi thẳng (không rẽ nhánh) — **giữ nguyên** trong spec này.
  - `executeSingleNode`: `parseConfig` → `parseInput` → resolve credential → `execute` → ghi node log; lỗi ở node nào thì dừng, execution `FAILED`.
  - `error.summary` (Gmail dùng) được ghi vào `output` của log khi lỗi.
  - Execution chạy **đồng bộ** trong request `POST /api/executions`.
- **Đang thiếu:**
  - ❌ Kiểu `Item` và hợp đồng input / output chung.
  - ❌ Engine lặp theo item cho node `per_item`.
  - ❌ Bộ resolve biểu thức; engine chưa đọc `config_schema` để biết field nào là biểu thức.
  - ❌ Lưu output của mọi node đã chạy để tham chiếu `$node[...]`.
  - ❌ Paired item.
  - ❌ Kiểm tra credential thuộc đúng connector (hiện chỉ kiểm tra owner).

### 2.2. Executor
| Node | Hiện tại | Sau spec này |
|---|---|---|
| `trigger.manual` | trả `null` | `once`, trả **1 item rỗng** `{}` để khởi động luồng |
| `integration.google_sheet.readRows` | input phải `null`, trả mảng object | `once`, mỗi dòng sheet là 1 item |
| `logic.filter` | nhận mảng, tự `.filter()` | `per_item`, giữ hoặc bỏ item |
| `integration.gmail.send` | nhận mảng `{name,email}`, tự lặp, tự thay template, trả object đếm | `per_item`, mỗi item gửi 1 email; `to` / `subject` / `body` là biểu thức engine resolve; trả kết quả gửi |
| `data.aggregate` | — (chưa có) | **mới**, `once`, gộp mọi item thành 1 item |

### 2.3. Catalog / Database
- `node_type_definitions.config_schema` đã có `x-allowExpression` cho Filter (`field`, `value`) và Gmail (`subject`, `body`).
- Gmail **chưa có** field `to` trong seed (đang lấy cứng `recipient.email`).
- Category `DATA_PROCESSING` đã có trong enum nhưng chưa có node nào → Aggregate là node đầu tiên.
- **Không cần migration.** Chỉ cập nhật seed.

### 2.4. Frontend
- `PropertiesPanel` placeholder `{{nodeId.output}}` sai cú pháp → đổi theo cú pháp mới.
- Màn hình log (`VersionDetailPage`) hiển thị `input` / `output` bằng `JSON.stringify` → tự hiển thị được dạng item mới; thêm số item mỗi node.
- ❌ Chưa cảnh báo khi đặt tên node trùng.

---

## 3. Phạm vi (Scope)

### Trong phạm vi (In-Scope)
- Kiểu `Item` và hợp đồng dữ liệu giữa các node.
- Hai kiểu chạy node do executor khai báo: `per_item` và `once`.
- Bộ resolve biểu thức (cú pháp ở mục 5), chỉ áp lên field có `x-allowExpression: true`.
- Paired item và tham chiếu `$node["Tên"]`.
- Lỗi theo item: engine tự ghi `summary` cho mọi node `per_item`.
- Kiểm tra credential đúng connector (`expectedConnectorKey`).
- Chuyển 4 executor hiện có sang hợp đồng mới; thêm node `data.aggregate`.
- **Tương thích ngược** với workflow MVP đã publish.

### Ngoài phạm vi (Out-of-Scope)
- Rẽ nhánh (IF / Switch), chạy song song, nhiều output handle — engine vẫn chạy chuỗi thẳng.
- Biểu thức JavaScript / hàm / phép toán (`{{ $json.a + 1 }}`, `.toUpperCase()`).
- Dữ liệu nhị phân (file đính kèm) trên item.
- Node `Split` (tách mảng trong 1 item thành nhiều item).
- Gợi ý / autocomplete biểu thức trên UI; xem trước giá trị biểu thức.
- Mask field `x-secret` trong log.
- Validate config theo `config_schema` lúc publish.
- Chạy execution bất đồng bộ (BullMQ).

---

## 4. Hợp đồng item (Item Contract)

### 4.1. Item
```
Item = {
  json: object          // dữ liệu của item
  pairedItem?: number   // index của item input đã sinh ra item này (engine tự gán với node per_item)
}
```
- Dữ liệu giữa hai node **luôn là `Item[]`** (có thể rỗng).
- Bọc trong `json` để sau này thêm `binary` (file) mà không đổi hợp đồng.

### 4.2. Kiểu chạy node (run mode) — do executor khai báo, người dùng không cấu hình

| Run mode | Engine làm gì | Ví dụ |
|---|---|---|
| `per_item` | Với **mỗi** item input: resolve config theo item đó → gọi executor → nhận 0..n object → bọc thành item, gán `pairedItem` = index item input. Ghép tất cả theo thứ tự. | Filter, Gmail, LLM |
| `once` | Resolve config **một lần** (theo item input đầu tiên, hoặc `{}` nếu không có item) → gọi executor với **toàn bộ** `Item[]` → nhận `Item[]`. | Manual Trigger, Sheet, Aggregate |

- Node `per_item` nhận 0 item → không chạy lần nào, output `[]`, node log `SUCCESS`. Các node sau cũng nhận `[]`.
- Executor `per_item` trả `null` hoặc `[]` → item đó bị bỏ (cách Filter loại item).

### 4.3. Ví dụ luồng MVP với hợp đồng mới
```
Manual Trigger  → [ {json:{}} ]
Read Customers  → [ {json:{name:"Kiet",email:"kiet@gmail.com",status:"new"}},
                    {json:{name:"An",  email:"an@gmail.com",  status:"contacted"}},
                    {json:{name:"Minh",email:"minh@gmail.com",status:"new"}} ]
Only New        → [ {json:{name:"Kiet",...}, pairedItem:0},
                    {json:{name:"Minh",...}, pairedItem:2} ]
Send Welcome    → [ {json:{to:"kiet@gmail.com",status:"sent",message_id:"..."}, pairedItem:0},
                    {json:{to:"minh@gmail.com",status:"sent",message_id:"..."}, pairedItem:1} ]
```

---

## 5. Cú pháp biểu thức (Expression Syntax)

Biểu thức nằm trong `{{ ... }}`, chỉ được resolve ở field có `x-allowExpression: true`. **Không phải JavaScript** — chỉ là đường dẫn truy cập dữ liệu, không thể chạy code.

| Biểu thức | Ý nghĩa |
|---|---|
| `{{$json.name}}` | field `name` của item hiện tại |
| `{{$json.customer.address.city}}` | đường dẫn lồng nhau |
| `{{$json.tags[0]}}` | phần tử mảng |
| `{{$json["full name"]}}` | key có dấu cách / ký tự đặc biệt |
| `{{$node["Read Customers"].json.email}}` | item của node **Read Customers** tương ứng với item hiện tại (qua paired item) |
| `{{$node["Read Customers"].all}}` | mảng `json` của **mọi** item output của node đó |
| `{{name}}` | **tương thích ngược** — tương đương `{{$json.name}}` |

### 5.1. Quy tắc giá trị
- **Cả field chỉ có đúng một biểu thức** (`"{{$json.amount}}"`) → giữ **nguyên kiểu** (number, object, array, boolean, `null`). Không tồn tại → `null`.
- **Biểu thức lẫn trong chuỗi** (`"Chào {{$json.name}}!"`) → nối thành chuỗi; chuỗi giữ nguyên, kiểu khác `JSON.stringify`; không tồn tại / `null` → chuỗi rỗng.
- Field không có `{{` → giữ nguyên.
- Cú pháp sai (`{{$json.}}`, `{{$foo}}`) → node `FAILED` với thông báo chỉ rõ field và biểu thức.

### 5.2. Tham chiếu `$node["Tên"]`
- **Tên** là `data.name` của node trên canvas (tên người dùng đặt).
- Chỉ tham chiếu được node **đã chạy trước** node hiện tại.
- Tên không tồn tại, trùng tên giữa nhiều node, hoặc node chưa chạy → node `FAILED` với thông báo rõ. Tên không tồn tại → gợi ý *"có thể node đã bị đổi tên"*.
- **Quyết định:** tham chiếu theo **tên** (dễ đọc, viết tay được) thay vì id (ổn định nhưng không viết tay được khi chưa có UI chọn node). Đổi tên node làm hỏng biểu thức tham chiếu tới nó — chấp nhận ở v1; tự cập nhật biểu thức khi đổi tên để spec sau.
- `.json` đi ngược chuỗi `pairedItem` từ item hiện tại về node được tham chiếu. Nếu chuỗi đứt (đi qua node `once` không gán `pairedItem`, ví dụ Aggregate) → node `FAILED`: *"Không xác định được item tương ứng của node 'X'. Dùng `.all` để lấy toàn bộ item."*

---

## 6. Quy tắc nghiệp vụ (Business Rules)

1. **Engine sở hữu luồng dữ liệu:** executor không tự lặp danh sách (trừ node `once` cần cả danh sách), không tự xử lý template, không tự ghép dữ liệu node trước.
   - **Output chỉ chứa kết quả của chính node đó** — không copy field của item input (tránh đụng tên field, tránh dữ liệu phình qua mỗi node). Dữ liệu node trước lấy qua `$node["Tên"]`. Ngoại lệ: Filter trả nguyên item vì chỉ quyết định giữ / bỏ.
2. **Chỉ resolve field `x-allowExpression`:** engine đọc `config_schema` của node type từ catalog; field không đánh dấu giữ nguyên dù có chứa `{{`.
3. **Lỗi theo item:** item thứ *k* của node `per_item` lỗi → dừng node, node `FAILED`, execution `FAILED`. Engine ghi `summary = { total_items, processed, failed_at_index }` vào `output` của node log — áp dụng cho **mọi** node `per_item`, executor không phải tự làm. Không truyền output một phần sang node sau.
4. **Credential đúng connector:** executor khai báo connector mong đợi; credential của connector khác → node `FAILED`. Áp dụng cho Sheet và Gmail (`google`).
5. **Credential resolve một lần mỗi node**, không phải mỗi item. `credential_id` không phải biểu thức.
6. **Tương thích ngược** — workflow MVP đã publish (`Welcome, {{name}}!`, Filter `status equals new`, Gmail không có `to`) phải chạy ra **cùng kết quả gửi mail** như trước:
   - `{{name}}` không có `$` → hiểu là `{{$json.name}}`.
   - Gmail thiếu `to` → mặc định `{{$json.email}}`.
   - Filter giữ nguyên ý nghĩa config `field` / `operator` / `value`.
7. **Định dạng log thay đổi:** `input` / `output` trong `execution_node_logs` của execution mới là `Item[]`. Log cũ giữ nguyên, **không chuyển đổi**. Output Gmail đổi từ object đếm `{sent_count, ...}` sang danh sách kết quả từng email; màn hình log hiển thị số item mỗi node thay cho con số tổng.
8. **Seed luôn đồng bộ catalog:** upsert node type / connector phải cập nhật `config_schema` (và metadata hiển thị) khi bản ghi đã tồn tại — catalog do hệ thống quản lý, ghi đè an toàn. Nếu không, môi trường đã seed trước sẽ giữ schema cũ và chạy sai mà không báo lỗi.
9. **Không chạy code người dùng:** bộ resolve chỉ truy cập dữ liệu, không `eval`, không `new Function`.

---

## 7. Đặc tả node thay đổi / mới

### 7.1. Filter (`logic.filter`) — `per_item`
- Config giữ nguyên: `field` (đường dẫn trong `$json`, hỗ trợ dot path; **không còn là biểu thức**), `operator` (`equals` | `not_equals` | `contains`), `value` (biểu thức).
- Item khớp → giữ nguyên `json`; không khớp → bỏ.

### 7.2. Gmail (`integration.gmail.send`) — `per_item`
- Config: `credential_id`, `to` (biểu thức, mặc định `{{$json.email}}`), `subject` (biểu thức), `body` (biểu thức).
- Mỗi item gửi đúng 1 email với giá trị đã resolve.
- Output item: `{ to, status: "sent", message_id }`.

### 7.3. Google Sheet (`integration.google_sheet.readRows`) — `once`
- Bỏ yêu cầu input phải `null`; bỏ qua input.
- Mỗi dòng dữ liệu (theo header) → 1 item.

### 7.4. Manual Trigger (`trigger.manual`) — `once`
- Output `[ { json: {} } ]`.

### 7.5. Aggregate (`data.aggregate`) — mới, `once`, category `DATA_PROCESSING`
- Config: `field` (string, mặc định `items`).
- Output: đúng **1 item** `{ [field]: [json của mọi item input] }`, không có `pairedItem`.
- Dùng để biến nhiều item thành một — ví dụ gom toàn bộ dòng để LLM tóm tắt một lần:
  ```
  Sheet → Aggregate → LLM (prompt: "Tóm tắt: {{$json.items}}")
  ```

---

## 8. Tiêu chí nghiệm thu (Acceptance Criteria)

1. Workflow MVP `Manual → Sheet → Filter → Gmail` **đã publish trước khi đổi engine** chạy thành công, gửi đúng 2 email `Welcome, Kiet!` / `Welcome, Minh!`.
2. Gmail với `to = {{$node["Read Customers"].json.email}}` đặt sau một node `per_item` khác gửi đúng người nhận của từng dòng.
3. `{{$json.amount}}` đứng một mình giữ kiểu number; `"Nợ {{$json.amount}}đ"` thành chuỗi.
4. Field không có `x-allowExpression` chứa `{{x}}` không bị resolve.
5. Filter loại hết item → các node sau chạy với `[]`, execution `SUCCESS`.
6. Item thứ 2/3 của Gmail lỗi → execution `FAILED`, log Gmail có `summary { total_items: 3, processed: 1, failed_at_index: 1 }`.
7. `$node["Không tồn tại"]`, tên trùng, cú pháp sai, chuỗi paired đứt → node `FAILED` với thông báo chỉ rõ nguyên nhân.
8. Aggregate gộp 3 item thành 1 item `{ items: [...] }`; `$node["..."].all` trả đủ 3 phần tử.
9. Credential Google dùng cho node yêu cầu connector khác (hoặc ngược lại) → node `FAILED`.
10. Placeholder trên `PropertiesPanel` hiển thị cú pháp mới.
11. Đặt tên node trùng với node khác trên canvas → hiện cảnh báo.
12. Màn hình log execution hiển thị số item input / output của mỗi node.
13. Chạy seed trên DB đã seed từ trước → `config_schema` của Gmail / Filter được cập nhật.
