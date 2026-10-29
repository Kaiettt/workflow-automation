# BÁO CÁO TIẾN ĐỘ TUẦN 07

## 1. Thông tin chung

- **Tên đề tài:** CrabFlowPilot – Nền tảng thiết kế và tự động hóa quy trình (Workflow Automation)
- **Học kỳ:** Học kỳ 1, năm học 2026–2027
- **Tuần báo cáo:** Tuần 07
- **Thời gian báo cáo:** 19/10/2026 – 25/10/2026
- **Sinh viên thực hiện:** Nguyễn Anh Kiệt - MSSV: 23110246, Nguyễn Văn Hiếu - MSSV: 23110214
- **Giảng viên hướng dẫn:** Nguyễn Hữu Trung
- **Mã nguồn dự án:** `workflow-automation`
- **Nhánh làm việc:** `master` (tích hợp từ nhánh `feat/workflow-validation` qua PR #26)
- **Ngày chốt số liệu:** 25/10/2026

---

## 2. Mục tiêu của tuần

Trọng tâm của tuần 07 là hoàn thiện cơ chế **Xác thực và Kiểm tra tính toàn vẹn của quy trình trước khi xuất bản (Workflow Publish Validation)** trên cả hai tầng Backend và Frontend, đồng thời khắc phục hạn chế lớn nhất từ tuần trước bằng việc **thiết lập hệ thống kiểm thử tự động cho giao diện Frontend**.

Trước đây, hệ thống cho phép người dùng bấm xuất bản (Publish) bất kỳ bản nháp (draft) nào trên canvas mà không kiểm tra tính khả thi khi thực thi. Điều này dẫn đến việc xuất bản các workflow lỗi hoặc không thể chạy được: workflow không có node kích hoạt (Trigger), workflow chỉ có trigger mà không có tác vụ xử lý (Action), các node bị đứt kết nối nằm "mồ côi" trên canvas, hoặc các node chưa được điền đủ thông tin cấu hình bắt buộc.

Các mục tiêu cụ thể gồm:

1. **Xây dựng bộ đặc tả kỹ thuật `workflow-publish-validation`:** Thiết kế quy chuẩn hợp đồng dữ liệu lỗi, phân loại các điều kiện bất biến (invariants) của đồ thị workflow và định nghĩa bộ mã lỗi chuẩn (`specs/workflow-publish-validation/`).
2. **Hiện thực hóa bộ kiểm tra hợp lệ tại tầng Backend (Application Layer):** 
   - Kiểm tra cấu trúc đồ thị: bắt buộc có ít nhất 1 Trigger và ít nhất 1 Action.
   - Thuật toán kiểm tra tính liên thông và khả năng tiếp cận (Graph Reachability Traversal): mọi Action node đều phải được kết nối tới từ Trigger node qua các cạnh có hướng.
   - Kiểm tra tính đầy đủ của cấu hình node dựa trên `configSchema.required` từ catalog thông qua CQRS Query.
   - Kiểm soát tính hợp lệ trước khi tạo snapshot phiên bản bất biến (`WorkflowVersion`), lưu trữ lỗi vào draft (`draft.validationErrors`) và trả về mã lỗi HTTP 400 có cấu trúc.
3. **Hiện thực hóa trải nghiệm thông báo lỗi và tương tác sửa lỗi trên Frontend:**
   - Thay thế các thanh cảnh báo thô sơ bằng hộp thoại tương tác tiêu chuẩn (`PublishValidationDialog`) xây dựng trên `shadcn/ui`.
   - Nhóm lỗi thông minh theo từng node, ẩn các mã định danh kỹ thuật nội bộ (`actionNode-179...`), hiển thị tên node thân thiện và nhãn trường rõ ràng cho người dùng.
   - Trực quan hóa vị trí lỗi trực tiếp trên Canvas: hiển thị huy hiệu đếm số lỗi (error badge) và viền đỏ cảnh báo (ring indicators) trên từng node.
   - Cơ chế điều hướng tương tác (Deep Focus Navigation): người dùng nhấn vào thẻ lỗi trong hộp thoại sẽ tự động định vị, phóng to / căn giữa node trên canvas và mở bảng thuộc tính (`PropertiesPanel`) để sửa trực tiếp.
   - Đảm bảo cơ chế tự động lưu (auto-save) không vô tình xóa trạng thái lỗi hoặc đóng hộp thoại khi người dùng chưa hoàn tất việc sửa.
4. **Thiết lập nền tảng kiểm thử tự động Frontend và mở rộng kiểm thử Backend:**
   - Tích hợp Vitest, React Testing Library, jsdom vào ứng dụng Frontend; xây dựng các ca kiểm thử tự động cho toàn bộ luồng validation.
   - Bổ sung các ca kiểm thử đơn vị (Unit Tests) và kiểm thử tích hợp (E2E Tests) cho Backend, nâng tổng số test tự động toàn hệ thống.

---

## 3. Nội dung công việc đã thực hiện

### 3.1. Đặc tả kỹ thuật và kiến trúc dữ liệu (`specs/workflow-publish-validation`)

Nhóm đã hoàn thiện trọn vẹn bộ tài liệu đặc tả kỹ thuật làm kim chỉ nam triển khai:
- `spec.md`: Đặc tả yêu cầu chức năng, mô hình dữ liệu đồ thị trên canvas React Flow, và tiêu chí nghiệm thu (Acceptance Criteria).
- `design.md`: Kiến trúc thiết kế 3 tầng kiểm tra tuần tự (Existence -> Schema -> Graph Reachability), giải thuật duyệt đồ thị và quy trình lưu vết.
- `task.backend.md` & `task.frontend.md`: Bảng phân rã công việc chi tiết theo từng giai đoạn và định nghĩa hoàn thành (Definition of Done).

#### Hợp đồng dữ liệu lỗi kiểm tra (Validation Contract)

Dữ liệu lỗi trả về từ backend và quản lý trên frontend tuân thủ cấu trúc chuẩn:

```typescript
export interface PublishValidationIssue {
  code: 'NO_TRIGGER' | 'NO_ACTION' | 'UNKNOWN_NODE_TYPE' | 'REQUIRED_FIELD_MISSING' | 'ACTION_UNREACHABLE';
  severity: 'error';
  message: string;
  nodeId?: string;
  field?: string;
}

export interface PublishValidationReport {
  isValid: boolean;
  issues: PublishValidationIssue[];
}
```

#### Quy tắc kiểm tra và bộ mã lỗi chuẩn

| Mã lỗi (`code`) | Mức độ | Điều kiện kích hoạt | Ý nghĩa nghiệp vụ |
|---|---|---|---|
| `NO_TRIGGER` | `error` | Số lượng node thuộc nhóm `TRIGGER` trong đồ thị bằng 0 | Quy trình không có điểm kích hoạt bắt đầu |
| `NO_ACTION` | `error` | Số lượng node tác vụ/xử lý (`category !== 'TRIGGER'`) bằng 0 | Quy trình chỉ có trigger mà không thực hiện công việc nào |
| `UNKNOWN_NODE_TYPE` | `error` | Mã catalog của node không tìm thấy trong `NodeTypeDefinition` | Bản thiết kế chứa node không tồn tại hoặc đã bị xóa khỏi hệ thống |
| `REQUIRED_FIELD_MISSING` | `error` | Trường thuộc mảng `configSchema.required` bị thiếu, mang giá trị `null`, `undefined` hoặc chuỗi rỗng | Người dùng chưa điền đủ các thông tin bắt buộc để node có thể chạy |
| `ACTION_UNREACHABLE` | `error` | Một action node không có đường đi có hướng xuất phát từ bất kỳ trigger node nào | Node bị ngắt kết nối (mồ côi), dữ liệu không thể chảy tới node này |

---

### 3.2. Hiện thực Backend: Kiểm tra tính toàn vẹn của Workflow

Toàn bộ logic kiểm tra được đặt trong tầng ứng dụng của module Designer (`monolith-backend/libs/designer`), phối hợp cùng module Node Library qua CQRS:

```
[Client Publish Request]
           │
           ▼
[PublishWorkflowHandler]
           │
           ├── 1. Kiểm tra tồn tại Workflow & Draft definition
           │
           ├── 2. Dispatch GetNodeConfigSchemasQuery (CQRS) ──► [@app/node-library]
           │                                                        │
           │◄──────────────── Trả về Catalog Metadata & ConfigSchemas ──┘
           │
           ├── 3. validateWorkflowDraft()
           │      ├── Trích xuất catalog key: getNodeKey(node)
           │      ├── Kiểm tra số lượng Trigger & Action
           │      ├── Kiểm tra tính hợp lệ cấu hình theo configSchema.required
           │      └── Duyệt đồ thị (Graph Reachability) từ Trigger qua Adjacency List
           │
           ├── [Có lỗi (isValid = false)]
           │      ├── Lưu { issues } vào workflow_drafts.validationErrors
           │      └── Ném BadRequestException (HTTP 400 kèm issues)
           │
           └── [Hợp lệ (isValid = true)]
                  ├── Xóa sạch validationErrors cũ trên draft (nếu có)
                  ├── Tính số phiên bản tiếp theo: versionNumber = latest + 1
                  ├── Tạo bản ghi bất biến WorkflowVersion (snapshot definition)
                  └── Cập nhật workflow.currentVersionId = version mới
```

#### a. Phân giải mã định danh catalog (`getNodeKey`)

Trên canvas React Flow, các node đồ họa lưu mã loại node nghiệp vụ tại `node.data.key` (ví dụ: `trigger.manual`, `ai.llm.generate`, `integration.gmail.send`), trong khi thuộc tính `node.type` chỉ quy định component hiển thị trên canvas (`triggerNode`, `actionNode`). 

Hàm `getNodeKey` trích xuất chính xác mã catalog từ `node.data.key`, đồng thời hỗ trợ fallback về `node.type` đối với các fixture test cũ, đảm bảo tính tương thích tuyệt đối.

#### b. Truy vấn schema hàng loạt qua CQRS (`GetNodeConfigSchemasQuery`)

Để kiểm tra cấu hình mà không vi phạm nguyên tắc đóng gói module, handler trích xuất danh sách duy nhất các `nodeKeys` xuất hiện trong draft và gửi `GetNodeConfigSchemasQuery(nodeKeys)` qua NestJS `QueryBus` sang module `node-library`. Toàn bộ thông tin `category` và `configSchema` của các node liên quan được nạp trong một truy vấn duy nhất.

#### c. Thuật toán kiểm tra tính liên thông đồ thị (Graph Reachability Traversal)

Engine tự động hóa vận hành theo mô hình dòng chảy dữ liệu có hướng (directed dataflow). Do đó, mọi node tác vụ xử lý đều bắt buộc phải nhận được dữ liệu xuất phát từ ít nhất một Trigger:

1. Xây dựng danh sách kề `adjacency: Map<string, string[]>` từ mảng các liên kết `edges` (`source` $\to$ `target`).
2. Khởi tạo hàng đợi duyệt `pending` chứa ID của tất cả các Trigger node, và tập hợp `reachable = new Set<string>()`.
3. Thực hiện duyệt đồ thị theo chiều rộng (BFS): lấy từng node khỏi hàng đợi, đánh dấu vào `reachable`, và đẩy tất cả các node đích kết nối trực tiếp vào hàng đợi.
4. Lặp qua danh sách tất cả các Action node: nếu có bất kỳ action node nào không thuộc tập hợp `reachable`, hệ thống ghi nhận ngay mã lỗi `ACTION_UNREACHABLE` kèm `nodeId`.

#### d. Kiểm tra cấu hình bắt buộc theo schema

Hệ thống duyệt qua từng node, đối chiếu cấu hình người dùng đã lưu (`node.data.config`) với mảng `required` trong `configSchema` của node đó. Bất kỳ trường nào bị bỏ trống đều bị phát hiện với mã `REQUIRED_FIELD_MISSING`, trả về chính xác tên trường `field` và `nodeId`.

---

### 3.3. Hiện thực Frontend: Giao diện và trải nghiệm sửa lỗi trực quan

Phần giao diện người dùng được nâng cấp toàn diện, tập trung vào tính thẩm mỹ hiện đại và trải nghiệm hỗ trợ người dùng khắc phục lỗi nhanh nhất.

```
+------------------------------------------------------------------------------------+
|  [Header] FlowPilot Designer                      [ Errors (3) ]  [ Publish ]     |
+------------------------------------------------------------------------------------+
|                                                                                    |
|      +---------------------+                  +---------------------+              |
|      |  Manual Trigger     |                  |  Read Google Sheet  | [2]          |
|      |  (TriggerNode)      |                  |  (ActionNode)       | ◄-- Ring Đỏ  |
|      +----------+----------+                  +---------------------+              |
|                 |                                                                  |
|                 v                                                                  |
|      +---------------------+                  +---------------------+              |
|      |  Filter Active      |                  |  Send Email (Gmail) | [1]          |
|      |  (ActionNode)       |                  |  (ActionNode)       | ◄-- Ring Đỏ  |
|      +---------------------+                  +---------------------+              |
|                                                                                    |
|                                                                                    |
|         +-------------------------------------------------------------+            |
|         |  Workflow Issues Found                       [ 3 errors ]   |            |
|         |  Please resolve the following required fields or            |            |
|         |  connections before publishing.                             |            |
|         |                                                             |            |
|         |  +-------------------------------------------------------+  |            |
|         |  | Read Google Sheet                     (2 issues)  [>] |  |            |
|         |  | • Spreadsheet ID is required                          |  |            |
|         |  | • Credential is required                              |  |            |
|         |  +-------------------------------------------------------+  |            |
|         |  | Send Email (Gmail)                    (1 issue)   [>] |  |            |
|         |  | • This node is not connected to any trigger           |  |            |
|         |  +-------------------------------------------------------+  |            |
|         +-------------------------------------------------------------+            |
|                                                                                    |
+------------------------------------------------------------------------------------+
```

#### a. Hộp thoại phản hồi chuẩn mực (`PublishValidationDialog`)

- **Thiết kế theo chuẩn `shadcn/ui`:** Sử dụng component `Dialog`, `Card`, `Badge` và biểu tượng Lucide. Áp dụng phong cách thẻ màu trung tính (Neutral card style) kết hợp các điểm nhấn đỏ nhạt (`rose-50`, `rose-600`), loại bỏ tình trạng tràn ngập màu đỏ gay gắt gây ức chế cho người dùng.
- **Nhóm lỗi theo node:** Thay vì hiển thị một danh sách lỗi rời rạc, các lỗi được gom theo từng node (ví dụ: `Read Google Sheet (2 errors)`).
- **Ẩn hoàn toàn mã kỹ thuật nội bộ:** Không hiển thị các ID React Flow như `actionNode-1792770512845`. Thay vào đó, dialog hiển thị tên hiển thị do người dùng đặt hoặc tên loại node từ catalog.
- **Định dạng thông báo thân thiện (Human-friendly labels):**
  - Hàm `formatFieldLabel` ánh xạ các mã trường (`spreadsheet_id`, `credential_id`, `to`, `system_prompt`...) thành các nhãn tiếng Anh rõ nghĩa (`Spreadsheet ID`, `Credential`, `Recipient (To)`, `System Prompt`...).
  - Hàm `formatHumanFriendlyIssue` chuyển đổi mã lỗi kỹ thuật thành câu hướng dẫn hành động cụ thể: *"Spreadsheet ID is required"*, *"This node is not connected to any trigger"*.

#### b. Đánh dấu trực quan trên Canvas (`ActionNode` & `TriggerNode`)

- **Huy hiệu đếm lỗi (Error Badge):** Góc trên bên phải của các node có lỗi được gắn một huy hiệu màu đỏ nổi bật hiển thị chính xác số lượng lỗi của riêng node đó kèm hiệu ứng xuất hiện `animate-in zoom-in-75`.
- **Viền cảnh báo (Ring & Border):** Thân node được bổ sung viền ngoài `ring-2 ring-rose-500/80` và đổi màu viền sang tông đỏ cảnh báo `#f43f5e`. Thanh tiêu đề node chuyển sang màu đỏ `#e11d48` kèm biểu tượng `AlertCircle`.

#### c. Cơ chế điều hướng tương tác (Deep Focus Navigation)

Để tối ưu hóa thời gian sửa lỗi:
- Khi người dùng nhấp vào một thẻ lỗi trong hộp thoại:
  1. Hộp thoại tự động đóng lại để giải phóng không gian quan sát.
  2. Canvas React Flow tự động thực hiện cuộn và phóng to/căn giữa (`center / zoom`) vào vị trí của node bị lỗi đó.
  3. Node được tự động đặt trạng thái được chọn (`selected = true`).
  4. Thanh thuộc tính bên phải (`PropertiesPanel`) được tự động kích hoạt và mở ra đúng cấu hình của node đó, giúp người dùng có thể nhập thông tin thiếu ngay lập tức.

#### d. Nút "Errors" trên Header và an toàn khi tự động lưu

- Trên thanh điều hướng của Designer (`DesignerLayout`), khi phát hiện bản nháp có lỗi chưa giải quyết, hệ thống hiển thị nút **"Errors"** kèm badge đếm tổng số lỗi. Người dùng có thể nhấn vào nút này để mở lại hộp thoại kiểm tra bất kỳ lúc nào.
- Logic lưu bản nháp tự động (Auto-save) được tinh chỉnh: việc tự động lưu định kỳ sẽ **không** đóng hộp thoại và **không** tự ý xóa trạng thái lỗi trên giao diện khi người dùng chưa sửa dứt điểm.

---

### 3.4. Thiết lập hạ tầng kiểm thử tự động Frontend

Khắc phục hạn chế lớn nhất được ghi nhận trong tuần 06 ("Frontend chưa có test runner, toàn bộ kiểm thử giao diện phải thực hiện thủ công"), trong tuần 07 nhóm đã xây dựng hoàn chỉnh hạ tầng kiểm thử tự động cho Frontend:

- **Công cụ kiểm thử:** Tích hợp **Vitest v5**, `@testing-library/react v16`, `@testing-library/jest-dom v7`, và môi trường giả lập DOM **`jsdom v29`**.
- **Cấu hình npm scripts:** Bổ sung script `"test": "vitest run --environment jsdom"`.
- **Các bộ kiểm thử được xây dựng:**
  1. `workflow-validation.util.ts`: Kiểm thử các hàm định dạng nhãn trường, gom nhóm lỗi theo node, và xử lý các mã lỗi backend.
  2. `PublishValidationAlert.test.tsx`: Kiểm thử hiển thị cảnh báo và khả năng tập trung vào node lỗi.
  3. `PublishValidationDialog.test.tsx`: Kiểm thử toàn bộ các kịch bản hiển thị dialog, che giấu ID kỹ thuật, nhóm lỗi, và tương tác chọn thẻ lỗi.
  4. `DesignerPage.test.tsx`: Kiểm thử tích hợp luồng xuất bản thất bại: nhận lỗi từ API, kích hoạt dialog, hiển thị badge trên canvas và điều hướng node.
  5. `workflow.service.test.ts`: Kiểm thử bóc tách mã lỗi và mảng `issues` từ phản hồi HTTP 400 của backend.

---

## 4. Kiểm thử và kết quả

### 4.1. Thống kê bộ kiểm thử tự động

Sau khi bổ sung hạ tầng kiểm thử cho Frontend và viết thêm các ca kiểm thử cho module Designer Backend, toàn bộ dự án hiện sở hữu bộ kiểm thử tự động mạnh mẽ:

| Phân hệ | Loại kiểm thử | Công cụ | Số test cases | Trạng thái |
|---|---|---|:---:|:---:|
| **Monolith Backend** | Unit Tests (Ứng dụng, nghiệp vụ, executor, validation) | Jest | **213 passed** / 213 total | **100% PASS** |
| **Monolith Backend** | E2E Tests (Luồng HTTP, Database Postgres, Workflow Snapshot) | Jest + Supertest | **18 passed** / 18 total | **100% PASS** |
| **Frontend Designer** | Unit & Component Tests (Dialog, Utils, Page Integration) | Vitest + RTL + jsdom | **7 passed** / 7 total | **100% PASS** |
| **Toàn hệ thống** | **Tổng số ca kiểm thử tự động** | | **238 passed** | **100% PASS** |

- **So với tuần 06:** 
  - Backend Unit Tests tăng từ **192** lên **213** (+21 tests mới bao phủ toàn diện logic Publish Validation).
  - Frontend tăng từ **0** lên **7** component/unit tests tự động.
  - Tổng số unit tests tăng từ 192 lên 220 tests.

### 4.2. Kiểm tra chất lượng mã nguồn (Lint & Type Check)

- **Backend:** `npm run lint` trên toàn bộ thư mục `src`, `apps`, `libs`, `test` chạy qua `eslint` đạt kết quả sạch hoàn toàn (**0 errors, 0 warnings**).
- **Frontend:** `npm run lint` đạt kết quả sạch (**0 errors**). Kiểm tra kiểu dữ liệu với TypeScript (`tsc -b`) không có lỗi.

### 4.3. Kết quả nghiệm thu thực tế trên giao diện

Hệ thống đã được kiểm nghiệm thực tế qua các kịch bản thử nghiệm:

1. **Workflow rỗng hoặc thiếu trigger:** Kéo 1 node `Filter` hoặc `Send Email` lên canvas mà không có Trigger $\to$ Bấm Publish $\to$ Bị chặn ngay lập tức, hiển thị lỗi *"Workflow must contain at least one trigger node"*.
2. **Workflow chỉ có trigger:** Kéo duy nhất 1 node `Manual Trigger` lên canvas $\to$ Bấm Publish $\to$ Bị chặn, hiển thị lỗi *"Workflow must contain at least one action node"*.
3. **Thiếu trường cấu hình bắt buộc:** Thêm node `Google Sheet Read Rows` và node `Send Email`, chưa nhập Spreadsheet ID và Email người nhận $\to$ Bấm Publish $\to$ Bị chặn, dialog hiển thị nhóm theo 2 node, chỉ rõ *"Spreadsheet ID is required"*, *"Recipient (To) is required"*.
4. **Action node mồ côi (Unreachable):** Tạo một luồng từ `Manual Trigger` $\to$ `Google Sheet`, và đặt thêm 1 node `LLM` đứng độc lập không nối dây $\to$ Bấm Publish $\to$ Bị chặn, node LLM bị viền đỏ, dialog thông báo *"This node is not connected to any trigger"*.
5. **Điều hướng Deep Focus:** Bấm vào thẻ lỗi của node `Google Sheet` trong dialog $\to$ Dialog biến mất, màn hình tự phóng to tới vị trí node Google Sheet, viền node sáng lên và thanh PropertiesPanel tự mở sẵn trường Spreadsheet ID.
6. **Xuất bản thành công:** Điền đầy đủ thông tin, nối dây hoàn chỉnh $\to$ Bấm Publish $\to$ Hệ thống xuất bản thành công, tạo `WorkflowVersion` số mới (snapshot bất biến), xóa toàn bộ cờ lỗi trên draft và cập nhật `currentVersionId`.

---

## 5. Hạn chế và việc chưa làm

- Bộ kiểm thử E2E backend yêu cầu container Docker PostgreSQL thực tế đang chạy trên cổng 5433 và Redis trên cổng 6379; chưa có kịch bản tự động khởi tạo database in-memory cho CI pipeline khi môi trường thiếu Docker.
- Việc xác thực biểu thức (Expression validation) hiện tại mới dừng ở mức kiểm tra tĩnh các trường bắt buộc; chưa có cơ chế kiểm tra trước cú pháp biểu thức động phức tạp (ví dụ: `{{$node["Node Name"].json.field}}`) xem node được tham chiếu có thực sự tồn tại trong đường đi trước đó hay không.
- Kế hoạch chuyển đổi cơ chế chạy thực thi sang tiến trình nền với BullMQ (Redis) và nâng trần `LLM_MAX_ITEMS` được dời sang tuần 08 để ưu tiên hoàn thiện tính toàn vẹn và chất lượng bản phát hành (Publish Validation) trước.

---

## 6. Kế hoạch tuần tới

1. **Hiện thực hóa Execution chạy nền bằng BullMQ (Redis):**
   - Chuyển đổi lệnh gọi thực thi từ đồng bộ HTTP sang hàng đợi bất đồng bộ (Background Queue).
   - Thiết lập worker xử lý tác vụ, theo dõi tiến độ và ghi log thời gian thực.
2. **Nâng giới hạn tải và tối ưu hóa cho Node LLM:**
   - Nâng giới hạn trần `LLM_MAX_ITEMS` từ 100 lên quy mô lớn hơn khi đã chạy nền.
   - Tối ưu hóa việc khởi tạo SDK client của các nhà cung cấp LLM (OpenAI, Anthropic, Gemini) thông qua cơ chế tái sử dụng client (client caching / pooling) thay vì tạo mới ở mỗi item.
3. **Bổ sung kiểm thử biểu thức tham chiếu đồ thị:**
   - Xây dựng thêm bộ kiểm tra tính hợp lệ của biểu thức tham chiếu chéo giữa các node (`{{$node[...]}}`) trong quá trình publish validation.
4. **Mở rộng các ca kiểm thử tự động Frontend:**
   - Bổ sung thêm các ca kiểm thử giao diện cho thanh công cụ Canvas, bảng thuộc tính cấu hình node và các thao tác kéo thả.
