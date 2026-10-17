# Implementation Tasks: Execution Item Model & Expression Resolver

## 1. Database (Seed — không migration)

- [x] `seed-mvp.ts`: upsert node type cập nhật `configSchema` (thay `update: {}`)
- [x] `logic.filter`: bỏ `x-allowExpression` khỏi `field`
- [x] `integration.gmail.send`: thêm field `to` (`x-allowExpression`, `default: "{{$json.email}}"`), thêm vào `required`
- [x] Thêm node `data.aggregate` (category `DATA_PROCESSING`, config `field` default `items`)
- [x] Chạy seed 2 lần — không lỗi; chạy trên DB đã seed cũ → schema Gmail / Filter được cập nhật
- [x] Cập nhật `docs/schema/rule-for-config-schema.md`: cú pháp biểu thức, quy tắc giữ kiểu, `default` được engine điền

---

## 2. Backend

### 2.1. Execution — Domain
- [x] Kiểu `Item`, `ItemJson`
- [x] `IPerItemExecutor`, `IOnceExecutor`, `INodeExecutor` (thay `INodeExecutor`), `expectedConnectorKey?(rawConfig)`
- [x] Expression: AST + parser viết tay (`$json`, `$node["X"].json|.all`, `.key`, `[0]`, `["key"]`, tên trần, khoảng trắng)
- [x] Expression: `parseTemplate`, `evaluateTemplate` (giữ kiểu / nối chuỗi)
- [x] Expression: `resolveConfig` (chỉ `x-allowExpression`), `applySchemaDefaults`
- [x] Hàm đọc dot path dùng chung (Filter dùng lại)
- [x] Lỗi: `ExpressionError` (gốc), `ExpressionSyntaxError`, `NodeReferenceError` (không tìm thấy / chưa chạy / trùng tên), `PairedItemError`
- [x] Paired item lookup trên `RunState`
- [x] Port `NodeCatalogPort`; `resolveCredential` trả `{ connectorKey, secret }`
- [x] `NodeKeys.DATA_AGGREGATE`

### 2.2. Execution — Application
- [x] `NodeRunner`: resolve credential 1 lần + kiểm tra connector; nhánh `once` / `per_item`; gán `pairedItem`; `summary` khi lỗi item
- [x] `StartExecutionHandler`: tải config schema 1 lần, index tên node, `RunState`, truyền `Item[]` giữa node
- [x] Bỏ đọc `error.summary` do executor gắn
- [x] `ManualTriggerExecutor` → `once`, trả `[{ json: {} }]`
- [x] `GoogleSheetReadRowsExecutor` → `once`, bỏ input `null`, `expectedConnectorKey` → `google`
- [x] `FilterExecutor` → `per_item`, `field` là dot path
- [x] `GmailSendExecutor` → `per_item`, thêm `to`, bỏ vòng lặp / template / summary, `expectedConnectorKey` → `google`
- [x] `AggregateExecutor` (mới)

### 2.3. Execution — Infrastructure
- [x] `NodeCatalogAdapter` gọi `GetNodeConfigSchemasQuery` qua `QueryBus`
- [x] `PrismaExecutionRepository.resolveCredential` trả thêm `connector.key`

### 2.4. Node Library
- [x] `GetNodeConfigSchemasQuery` + handler (trả DTO `{ key, configSchema }`)
- [x] `NodeTypeDefinitionRepository.findByKeys`
- [x] Export query qua `index.ts`

### 2.5. Module assembly
- [x] `ExecutionModule`: đăng ký `AggregateExecutor`, `NodeCatalogPort → NodeCatalogAdapter` (`NodeRunner` do `StartExecutionHandler` tự khởi tạo, không phải provider)
- [x] `NodeLibraryModule`: đăng ký query handler mới

---

## 3. Frontend

- [x] `PropertiesPanel`: placeholder `{{$json.field}}` + text gợi ý cú pháp `$json` / `$node["Tên"]`
- [x] Điền `default` của schema vào `config` khi thêm node lên canvas
- [x] Cảnh báo tên node trùng trong `PropertiesPanel`
- [x] `VersionDetailPage`: hiện `N items in → M items out` cho mỗi node

---

## 4. Kiểm thử & Đảm bảo chất lượng (QA & Verification)

- [x] Unit parser / template / `resolveConfig` (bảng test)
- [x] Unit paired item (qua Filter, qua Aggregate, các lỗi tên node)
- [x] Unit 5 executor
- [x] Cập nhật `start-execution.handler.spec.ts` theo hợp đồng mới, **giữ nguyên 3 kịch bản cũ**
- [x] Unit engine: `$node[...]` sau Filter; Filter rỗng; lỗi item → `summary`; credential sai connector; field không biểu thức
- [x] E2E `execution-run-ui.e2e-spec.ts` pass
- [x] E2E mới `execution-item-model.e2e-spec.ts`: wiring thật (QueryBus giữa execution ↔ node-library, Prisma, Postgres), tự dọn dữ liệu
- [x] Frontend: ô đổi tên node (shadcn `Input`), tự đặt tên node duy nhất khi kéo vào canvas (hiện chưa có cách đổi tên node, và tên mặc định trùng nhau)
- [ ] Test tự động cho frontend: dự án chưa có test runner (chỉ kiểm tra bằng lint + tsc + build và chạy thử các hàm thuần)
- [ ] Chạy thật workflow MVP **đã publish từ trước** với tài khoản Google thật → gửi đúng 2 email (chưa làm: cần credential Google thật; DB local chưa có workflow MVP nào dùng Google Sheet. Tương thích ngược hiện chỉ được chứng minh bằng unit test tái hiện đúng định nghĩa demo)
- [x] `npm run lint` + `npm test` backend, `npm run build` frontend — 0 lỗi
