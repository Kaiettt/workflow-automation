# Technical Design: Node cho chatbot

## 1. Hiện trạng liên quan

- `getExecutionOrder` (`libs/execution/src/domain/entities/workflow-execution.entity.ts`) bắt buộc các cạnh tạo thành **một chuỗi**: node nào có hai cạnh ra hoặc hai cạnh vào đều lỗi. `WorkflowEngine.runNodes` chạy tuần tự, input của node = output của node trước.
- `validateWorkflowDraft` (designer) chỉ kiểm tra tới được từ trigger, nên đồ thị có nhánh publish được rồi mới lỗi khi chạy.
- `createExpressionContext.getPairedJson` (`run-state.ts`) dò item tương ứng bằng cách đi lùi `runs[pos-1]`, tức giả định node trước trong danh sách là node cha.
- Handle trên canvas có id `<side>-source` / `<side>-target` (4 phía) chỉ để vẽ, không mang ý nghĩa đầu ra.
- `NodeExecutionStatus.SKIPPED` đã có trong DB (`execution_node_logs`).
- `LlmGenerateRequest` chỉ có `systemPrompt` + `prompt` (một lượt).
- Package action (`ActionNode.execute`) trả item, không có khái niệm nhiều đầu ra.

## 2. Engine chạy đồ thị (P1)

### 2.1. Định nghĩa

```ts
interface WorkflowEdge {
  source: string; target: string;
  sourceHandle?: string;   // đã có sẵn trong dữ liệu React Flow
}
```

- **Đầu ra của node:** node type khai báo `outputs?: OutputDef[]` (`{ key, label }`). Không khai báo = một đầu ra `main`.
- Cạnh từ node nhiều đầu ra mang `sourceHandle = "out:<key>"`. Cạnh cũ (`right-source`, …) hoặc thiếu `sourceHandle` = đầu ra `main`.
- Node có đầu ra động (Switch: mỗi luật một đầu ra) tính `outputs` từ config: catalog trả `x-outputs` dạng `{ static: [...] }` hoặc `{ fromConfig: 'rules', labelField: 'label', fallback: true }`. Frontend và engine dùng chung một hàm `resolveOutputs(nodeType, config)` (backend ở `libs/execution/domain`, frontend tự cài lại cùng quy tắc).

### 2.2. Hợp đồng executor

```ts
// Thêm vào IPerItemExecutor / IOnceExecutor, không bắt buộc.
// Item trả về có thể gắn đầu ra; không gắn = 'main'.
type RoutedJson = { output: string; json: ItemJson };
executeItem(...): Promise<ItemJson | ItemJson[] | RoutedJson | RoutedJson[] | null>;
```

`NodeRunner` trả `outputs: Map<string, Item[]>` thay cho `output: Item[]`. Executor cũ chỉ sinh `main`, nên không phải sửa.

### 2.3. Thứ tự và kích hoạt

```
plan = buildGraphPlan(definition)   // thay getExecutionOrder
  - kiểm: mọi cạnh trỏ tới node có thật, không chu trình (Kahn), đúng một node bắt đầu
    (trigger, không có cạnh vào)
  - trả: thứ tự topo + danh sách cạnh vào của từng node
```

Chạy theo thứ tự topo. Với mỗi node:
- Cạnh vào `e` **được kích hoạt** khi node nguồn đã chạy thành công và:
  - `e` từ đầu ra `main` của node một đầu ra: luôn kích hoạt (kể cả 0 item, để giữ hành vi cũ, ví dụ Filter lọc hết thì node sau vẫn chạy với `[]`).
  - `e` từ một đầu ra có tên: chỉ khi đầu ra đó có ≥ 1 item.
- Không có cạnh vào nào được kích hoạt → node `SKIPPED` (ghi log, không có output, coi như không kích hoạt cạnh ra).
- Có ≥ 1: input = nối item của các cạnh được kích hoạt theo thứ tự cạnh. Node gộp chạy **một lần**, sau khi mọi node cha đã chạy hoặc bị skip (thứ tự topo bảo đảm).
- Node lỗi → dừng execution, `FAILED` như hiện nay. Các node còn lại không ghi log (giữ như cũ).

`start-execution.command.ts` gọi `engine.executionOrder()` để kiểm định nghĩa trước khi lưu: đổi sang `buildGraphPlan`.

### 2.4. Tìm item tương ứng qua nhánh

Mỗi item đưa vào node mang nguồn gốc:

```ts
interface NodeRun {
  nodeId; nodeName;
  input: Item[];
  inputSources: Array<{ nodeId: string; index: number }>;  // mới, song song với input
  outputs: Map<string, Item[]>;
  output: Item[];   // = nối mọi đầu ra theo thứ tự khai báo, cho $node[...].all và log
}
```

- Item trong `output` có `pairedItem` = vị trí trong `input` của chính node đó (như hiện nay).
- `getPairedJson(name)`: bắt đầu từ item hiện tại ở vị trí `i` của input node đang chạy → `inputSources[i]` cho ra `(nodeId, index)` trong `output` của node cha → nếu là node cần tìm thì trả `json` → không thì theo `pairedItem` về input của node cha → `inputSources` của nó → lặp.
- `runs` đổi từ mảng tuần tự sang `Map<nodeId, NodeRun>`. Lỗi "has not run before this node" giữ nguyên khi node chưa chạy hoặc bị skip.

### 2.5. Validation khi publish

`validateWorkflowDraft` thêm:
- `GRAPH_CYCLE`: đồ thị có chu trình.
- `MULTIPLE_START`: nhiều hơn một node không có cạnh vào (hiện chỉ cho một trigger mỗi workflow).
- `UNKNOWN_OUTPUT`: cạnh nối từ đầu ra không còn tồn tại (ví dụ xoá luật Switch). Là lỗi vì cạnh đó không bao giờ chạy.

Dùng chung `buildGraphPlan` (đặt hàm thuần ở một chỗ cả designer và execution import được, ví dụ `libs/shared` nếu có, nếu không thì designer tự kiểm chu trình bằng DFS).

### 2.6. Frontend

- `nodeTypes` từ catalog có `outputs` (đã resolve sẵn theo `x-outputs`).
- `BaseNode`: node có > 1 đầu ra vẽ các handle source ở cạnh phải, xếp dọc, kèm nhãn (`True` / `False`, tên luật, `Fallback`), id `out:<key>`. Node một đầu ra giữ 4 handle như hiện tại.
- Cạnh từ đầu ra có tên hiện nhãn nhỏ trên đường nối.
- Trang execution: node `SKIPPED` hiện mờ và có nhãn "Skipped".

## 3. IF / Switch / Edit Fields (P2)

Executor nội bộ ở `libs/execution/src/application/executors/`, node type seed trong `prisma/seed-mvp.ts` (cùng chỗ với `logic.filter`).

### 3.1. Điều kiện dùng chung (`domain/conditions.ts`)

```ts
interface Condition {
  value1: unknown;           // thường là biểu thức {{$json.text}}
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with'
          | 'ends_with' | 'regex' | 'is_empty' | 'is_not_empty' | 'gt' | 'lt';
  value2?: unknown;
}
evaluate(conditions: Condition[], combine: 'and' | 'or', opts: { ignoreCase, ignoreAccents }): boolean
```
- Chuỗi so sánh sau khi chuẩn hoá (bỏ dấu dùng lại hàm của `libs/apps/src/core/text.ts`, chuyển sang chỗ dùng chung nếu cần).
- `gt` / `lt`: ép số, không phải số thì là `false`.
- `regex`: biên dịch một lần mỗi node, giới hạn độ dài pattern 500 ký tự để giảm rủi ro ReDoS.
- Filter giữ nguyên executor cũ (không đổi config), về sau có thể chuyển sang dùng `evaluate`.

### 3.2. IF (`logic.if`)
- Config: `conditions[]`, `combine`, `ignore_case`, `ignore_accents`.
- `outputs: [true, false]`. Per item: trả `{ output: 'true' | 'false', json: item.json }`.

### 3.3. Switch (`logic.switch`)
- Config: `rules[]` (`{ label, conditions[], combine }`), `mode: 'first' | 'all'`, `fallback: boolean`, `ignore_case`, `ignore_accents`.
- `x-outputs: { fromConfig: 'rules', labelField: 'label', fallback: true }`. Key đầu ra là `rule_<index>` (không dùng nhãn làm key để đổi tên luật không làm đứt cạnh); fallback là `fallback`.
- Xoá luật ở giữa: frontend đổi `sourceHandle` của các cạnh phía sau cho khớp chỉ số mới.

### 3.4. Edit Fields (`data.set`)
- Config: `fields[]` (`{ name, value }`, `value` cho phép biểu thức, `name` là đường dẫn chấm `a.b`), `keep_other_fields: boolean` (mặc định `true`).
- Per item, trả object mới. Giá trị biểu thức giữ kiểu (số, object) như `resolveConfig` đang làm.

## 4. Chat Memory (P3)

### 4.1. Lưu trữ
Redis (đã có), không cần migration:
- Khoá `flowpilot:chatmem:<workflowId>:<sha256(sessionKey)>`, kiểu list, mỗi phần tử JSON `{ role: 'user' | 'assistant', content, at }`.
- `save`: `RPUSH` rồi `LTRIM -max_messages -1`, `EXPIRE ttl`.
- `load`: `LRANGE -window -1`.
- `clear`: `DEL`.

Lý do: dữ liệu tạm, cần nhanh, tự hết hạn. Nếu về sau cần xem lịch sử trên UI thì mới chuyển sang Postgres.

### 4.2. Node `memory.chat`
- Executor nội bộ (cần `workflowId` → thêm `context: { workflowId, executionId }` vào tham số `executeItem`; executor cũ bỏ qua).
- Config:
  - `mode: load | save | clear`
  - `session_key` (biểu thức, mặc định `{{$node["Messenger Trigger"].json.sender_id}}`)
  - `window` (load, mặc định 10 lượt = 20 tin)
  - `user_message`, `assistant_message` (save, biểu thức)
  - `ttl_days` (mặc định 7), giới hạn cứng 50 lượt mỗi phiên.
- Output:
  - `load`: `{ ...item.json, history: [...], history_text }` (giữ dữ liệu đầu vào để node sau vẫn dùng `$json.text`).
  - `save` / `clear`: trả lại `item.json`.

### 4.3. LLM nhiều lượt
- `LlmGenerateRequest` thêm `history?: Array<{ role: 'user' | 'assistant'; content: string }>`.
- Ba adapter (Anthropic, OpenAI, Gemini) chèn `history` trước `prompt`. Gemini dùng role `model` cho assistant.
- Config LLM thêm `history` (biểu thức, ví dụ `{{$json.history}}`), không bắt buộc. Parse: phải là mảng `{role, content}`, sai thì báo lỗi rõ.

## 5. Messenger (P4)

### 5.1. Trigger
- `parseMessengerEvents` nhận thêm:
  - `messaging[].postback` → event `type: 'postback'`, `text = postback.title`, `payload = postback.payload`, id = `postback.mid` (hoặc `sender + timestamp` nếu thiếu).
  - `message.quick_reply.payload` → `payload` trong event tin nhắn.
- Output thêm `type: 'message' | 'postback'`, `payload: string | null`.
- Property mới `events` (`options`, mặc định `message,postback`). `accepts` lọc theo `type`.
- Đăng ký webhook thêm field `messaging_postbacks` (cần chạy lại `create` cho endpoint cũ: `checkExists` kiểm thêm fields, thiếu thì `create` lại).

### 5.2. Send Message
- Property `message_type: text | quick_replies | buttons | attachment`.
  - `quick_replies`: danh sách `{ title, payload }` (≤ 13, title ≤ 20 ký tự).
  - `buttons`: `text` + danh sách `{ type: postback | web_url, title, payload | url }` (≤ 3).
  - `attachment`: `attachment_type: image | file | video | audio` + `url`.
- Property dạng danh sách cần kiểu `collection` trong hợp đồng package (`NodeProperty.type = 'collection'` với `fields`). Sinh JSON Schema `array` of `object`; frontend cần `CollectionField` (thêm / xoá dòng, dùng shadcn `Input`, `Button`).
- `MetaGraphApi.sendMessage(pageToken, recipientId, message)` tổng quát, `sendText` gọi lại nó.
- Lỗi Graph `code 10` / `subcode 2018278` (ngoài cửa sổ 24 giờ) → `AppApiError` với thông báo dễ hiểu, không retry.

### 5.3. Sender Action
`messenger.senderAction`: `page_id`, `recipient_id`, `action: typing_on | typing_off | mark_seen`. Gọi `POST /me/messages` với `sender_action`.

## 6. HTTP Request (P5)

Package mới `libs/apps/src/http` (`http.request`), đăng ký trong `packages.ts`.
- Credential type tuỳ chọn: `httpHeaderAuth` (`name`, `value`), `httpBearerAuth` (`token`), `httpBasicAuth` (`user`, `password`). Node có `credentialType` dạng lựa chọn: hợp đồng hiện chỉ cho một `credentialType` cố định, nên thêm `credentialTypes?: string[]` + property `authentication` (`none | header | bearer | basic`) và kiểm khớp ở `PackageActionExecutor`.
- Property: `method`, `url`, `query[]`, `headers[]`, `body_type: none | json | form | raw`, `body`, `timeout_ms` (mặc định 30 000, tối đa 120 000), `response_format: auto | json | text`, `fail_on_error_status` (mặc định `true`).
- Dùng `fetch` của Node, giới hạn kích thước phản hồi 5 MB.
- **Chặn SSRF:** phân giải DNS trước, từ chối `localhost`, `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `::1`, `fc00::/7`, `fe80::/10`, `0.0.0.0`; không tự theo redirect, tự theo tối đa 5 lần và kiểm lại từng lần. Biến môi trường `HTTP_REQUEST_ALLOW_PRIVATE=true` để tắt khi dev.
- Output: `{ status, headers, body }`. Lỗi 5xx / 429 / timeout là `retryable` (dùng retry sẵn có của `PackageActionExecutor`).

## 7. Gợi ý tên node (P6)

`findRunIndex` khi không thấy tên: so khớp không phân biệt hoa thường và khoảng trắng với các tên đang có, nếu có đúng một thì thêm "Did you mean "Messenger Trigger"?".

## 8. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Đổi engine làm hỏng workflow cũ | Cạnh không có `sourceHandle` = `main`, `main` luôn kích hoạt; chạy lại toàn bộ e2e hiện có. |
| Pairing qua chỗ gộp sai item | Unit test các ca: nhánh rồi gộp, gộp hai nguồn, tham chiếu node trước chỗ rẽ. |
| Switch xoá luật làm cạnh nối sai đầu ra | Frontend cập nhật `sourceHandle`; publish cảnh báo `UNKNOWN_OUTPUT`. |
| Chat memory lộ hội thoại giữa các workflow | Khoá gồm `workflowId`; băm `sessionKey`. |
| HTTP Request bị dùng để quét mạng nội bộ | Chặn SSRF ở tầng phân giải DNS, kiểm lại sau redirect. |
| Bot trả lời lặp vô hạn | Echo đã bị bỏ qua ở trigger (giữ nguyên). |
