# BÁO CÁO TIẾN ĐỘ TUẦN 03

## 1. Thông tin chung

- **Tên đề tài:** CrabFlowPilot – Nền tảng thiết kế và tự động hóa quy trình (Workflow Automation)
- **Loại đề tài:** Điền theo mục đã đăng ký trên cổng projects-fit.hcmute.edu.vn
- **Học kỳ:** Học kỳ 1, năm học 2026–2027
- **Tuần báo cáo:** Tuần 03
- **Thời gian báo cáo:** 21/09/2026 – 27/09/2026
- **Sinh viên thực hiện:** Nguyễn Anh Kiệt - MSSV: 23110246, Nguyễn Văn Hiếu - MSSV: 23110214
- **Giảng viên hướng dẫn:** Nguyễn Hữu Trung
- **Mã nguồn dự án:** `workflow-automation`
- **Ngày chốt số liệu:** 27/09/2026

> **Lưu ý:** Cần điền thông tin cá nhân và điều chỉnh số tuần theo lịch chính thức trên cổng trước khi đăng.

---

## 2. Mục tiêu của tuần

Mục tiêu trọng tâm của tuần là khắc phục các điểm nghẽn kỹ thuật từ tuần trước, thiết kế kiến trúc chuẩn hóa cho phân hệ thực thi quy trình (Execution Engine MVP), và nâng cấp toàn diện Workflow Designer từ dữ liệu tĩnh sang hệ thống động điều khiển bởi dữ liệu (data-driven catalog & schema-based UI). Các mục tiêu cụ thể gồm:

- Khắc phục lỗi cập nhật cơ sở dữ liệu khi publish workflow và thiết lập Git hooks (Husky, ESLint prebuild) nhằm kiểm soát chất lượng mã nguồn.
- Thiết kế kịch bản MVP thực thi tích hợp thực tế: Manual Trigger -> Đọc dữ liệu Google Sheets -> Lọc điều kiện (Logic Filter) -> Gửi email qua Gmail.
- Chuẩn hóa bộ quy tắc Config Schema (`docs/schema/rule-for-config-schema.md`) với các chú giải mở rộng `x-*`, tạo nền tảng mở rộng hệ thống mà không cần sửa đổi mã nguồn cốt lõi.
- Hiện thực hóa Catalog API ở backend (`node-library`, `connector`) và xây dựng script `seed-mvp.ts` cung cấp dữ liệu danh mục mẫu độc lập.
- Nâng cấp Workflow Designer UI ở frontend: loại bỏ dữ liệu hard-code, tải danh mục node động từ API, hiển thị biểu tượng/màu sắc nhận diện, hỗ trợ kết nối 4 hướng (4-sided handles) và tự động sinh form cấu hình thuộc tính động (`PropertiesPanel`) từ JSON Schema.
- Hoàn thiện tài liệu thiết kế và đặc tả chi tiết cho luồng Google OAuth 2.0 (mã hóa AES-256-GCM) và lõi Execution Engine (Graph traversal, NodeHandler registry, log thực thi).

---

## 3. Nội dung công việc đã thực hiện

### 3.1. Ổn định luồng Publish Workflow và hoàn thiện công cụ kiểm soát mã nguồn

Đầu tuần, nhóm đã rà soát và xử lý dứt điểm các lỗi phát sinh trong luồng Publish Workflow:
- Sửa lỗi mapping và cập nhật quan hệ workflow/version trong `PrismaWorkflowVersionRepository` và `WorkflowVersionMapper` khi lưu bản ghi phiên bản mới.
- Cấu hình lại các script kiểm tra mã nguồn tự động (`prebuild: "npm run lint"` cho cả frontend và monolith-backend).
- Thiết lập công cụ Git Hooks sử dụng **Husky** (`.husky/pre-commit`), tự động chạy linter và kiểm tra cú pháp trước mỗi lần commit, ngăn chặn các lỗi định dạng hoặc vi phạm tiêu chuẩn coding lọt vào repository.

### 3.2. Thiết kế kịch bản và kiến trúc MVP Execution Engine

Nhóm đã xác định kịch bản hoàn chỉnh cho giai đoạn MVP của hệ thống thực thi: một luồng tự động hóa tích hợp dịch vụ thực tế gồm 4 bước:
1. **Manual Trigger (`trigger.manual`):** Kích hoạt workflow thủ công qua API hoặc nút bấm trên giao diện.
2. **Read Google Sheet Rows (`integration.google_sheet.readRows`):** Kết nối đến bảng tính Google Sheets để trích xuất danh sách dòng dữ liệu (ví dụ: danh sách khách hàng/đơn hàng).
3. **Logic Filter (`logic.filter`):** Lọc mảng dữ liệu nhận được theo điều kiện logic cấu hình (ví dụ: lọc các dòng có trạng thái `PENDING` hoặc doanh thu thỏa điều kiện).
4. **Send Gmail (`integration.gmail.send`):** Lặp qua các bản ghi đã lọc và gửi email thông báo cá nhân hóa qua tài khoản Gmail của người dùng.

Kịch bản này đảm bảo kiểm chứng đầy đủ 3 nhóm chức năng cốt lõi: Trigger khởi tạo, Xử lý logic nội bộ không cần dịch vụ ngoài, và Tích hợp bên thứ ba có xác thực bảo mật.

### 3.3. Chuẩn hóa Config Schema và kiến trúc mở rộng dựa trên dữ liệu (Data-Driven)

Để giải quyết bài toán "dễ mở rộng" (thêm connector/node type mới mà không phải sửa Engine core hay Designer UI), nhóm đã xây dựng tài liệu quy chuẩn `docs/schema/rule-for-config-schema.md`. Tài liệu định nghĩa bộ chú giải mở rộng `x-*` nhất quán trên nền JSON Schema chuẩn:

- `x-refType: "credential"`: Báo cho UI render bộ chọn credential; báo cho Execution Engine tự động giải mã token qua `CredentialVault` trước khi truyền vào executor.
- `x-connectorKey`: Ràng buộc định danh connector (ví dụ: `google`, `slack`), ngăn chặn việc chọn sai tài khoản giữa các dịch vụ.
- `x-allowExpression: true`: Đánh dấu các trường dữ liệu cho phép nội suy biến động runtime (cú pháp `{{nodeId.output}}`), giúp template resolver chỉ xử lý đúng trường cần thiết, tối ưu hiệu năng và tránh xung đột chuỗi.
- `x-secret: true`: Báo cho UI che dấu dữ liệu (input password) và yêu cầu Engine tự động làm mờ (mask thành `***`) trong nhật ký thực thi `execution_node_logs`.
- `x-testable: true`: Chỉ định các trường dữ liệu cần thiết cho chức năng kiểm tra kết nối tài khoản.

Quy chuẩn này phân định ranh giới rõ ràng: việc mở rộng thêm node mới chỉ cần thêm dữ liệu vào bảng `node_type_definitions` kèm schema, sau đó cài đặt một lớp `NodeExecutor` chuyên biệt mà không làm ảnh hưởng đến mã nguồn khung của Engine hay giao diện người dùng.

### 3.4. Hiện thực hóa Catalog API và dữ liệu mẫu Backend theo Clean Architecture

Backend đã được bổ sung hai module danh mục mới theo mô hình Modular Monolith, Clean Architecture và CQRS:

- **Module `node-library` (`libs/node-library`):**
  - Cung cấp query `GetNodeTypesQuery` và handler `GetNodeTypesHandler`.
  - Triển khai controller `NodeTypesController` công bố endpoint `GET /api/node-types`.
  - Được bảo vệ bằng `JwtAuthGuard`, trả về toàn bộ danh mục node đang hoạt động được sắp xếp theo nhóm (`category`) và tên hiển thị.
- **Module `connector` (`libs/connector`):**
  - Cung cấp query `GetConnectorsQuery` và handler `GetConnectorsHandler`.
  - Triển khai controller `ConnectorsController` công bố endpoint `GET /api/connectors` kèm `JwtAuthGuard`.
- **Dữ liệu mẫu độc lập (`prisma/seed-mvp.ts`):**
  - Khởi tạo tài khoản mẫu, cấu hình Connector `google` (hỗ trợ OAuth 2.0).
  - Nạp đầy đủ 4 Node Type Definitions phục vụ MVP (`trigger.manual`, `integration.google_sheet.readRows`, `logic.filter`, `integration.gmail.send`) kèm metadata màu sắc, icon URL và `configSchema` theo đúng quy chuẩn thiết kế.

### 3.5. Cải tiến và đồng bộ hóa Workflow Designer UI trên Frontend

Giao diện thiết kế quy trình (`DesignerPage.tsx`) đã được tái cấu trúc mạnh mẽ, loại bỏ toàn bộ dữ liệu tĩnh trước đó:

- **Dịch vụ & Store:** Bổ sung các phương thức gọi API trong `workflow.api.ts` và `workflow.service.ts`; tích hợp lưu trữ `nodeTypes` và `connectors` vào Zustand store (`designer.store.ts`). Designer tự động nạp danh mục node ngay khi người dùng truy cập.
- **Thanh công cụ Sidebar (`Sidebar.tsx`):**
  - Render danh sách các node kéo-thả hoàn toàn tự động từ danh mục backend.
  - Hỗ trợ hiển thị biểu tượng linh hoạt: tự động nhận diện và hiển thị logo vector từ URL bên ngoài (Google Sheets, Gmail) hoặc biểu tượng vector nội bộ (Play, Settings từ `lucide-react`).
  - Đường viền và thẻ phân loại được đồng bộ màu sắc theo thuộc tính `color` của từng node.
- **Cải tiến Node trên Canvas (`ActionNode.tsx`, `TriggerNode.tsx`):**
  - Gắn nhãn màu, tiêu đề và biểu tượng nhận diện tương ứng với định nghĩa node.
  - **Hỗ trợ kết nối 4 hướng (4-sided Handles):** Cả hai loại node Action và Trigger đã được nâng cấp bổ sung đầy đủ các handle Source và Target ở 4 cạnh (Top, Bottom, Left, Right). Cải tiến này giúp người dùng kết nối linh hoạt các nhánh quy trình phức tạp mà không bị gò bó theo chiều dọc cố định.

### 3.6. Xây dựng Dynamic Properties Panel dựa trên JSON Schema

Thành phần `PropertiesPanel.tsx` trước đây chỉ hiển thị ô nhập JSON thô (`textarea`), gây khó khăn cho người dùng. Trong tuần này, panel đã được viết lại thành bộ sinh form động dựa theo `configSchema.properties` của node được chọn:
- **Nút kết nối OAuth:** Khi trường có thuộc tính `x-connectorKey`, giao diện hiển thị nút liên kết tài khoản tương ứng (ví dụ: "Connect Google") kèm trạng thái trực quan.
- **Dropdown chọn lựa:** Khi trường có thuộc tính `enum`, giao diện render thẻ `<select>` chứa danh sách các tùy chọn cho phép (ví dụ: toán tử `equals`, `not_equals`, `contains` của Filter).
- **Hỗ trợ biểu thức động (`fx`):** Khi trường có thuộc tính `x-allowExpression: true`, giao diện hiển thị huy hiệu `fx` màu tím đặc trưng bên cạnh nhãn, kèm văn bản gợi ý cú pháp biến động (ví dụ: `{{nodeId.output}}`).

### 3.7. Hoàn thiện bộ đặc tả chi tiết cho các phân hệ tiếp theo (.scratch)

Nhóm đã hoàn thành các tài liệu đặc tả kỹ thuật chi tiết làm cơ sở triển khai trực tiếp:
- **Đặc tả OAuth 2.0 Integration (`3.1-oauth-backend-api.md`, `3.2-oauth-frontend-integration.md`):** Đặc tả tiện ích mã hóa `encryption.service.ts` chuẩn AES-256-GCM, các endpoint `/api/integrations/google/auth` và `callback`, cơ chế popup window và truyền token an toàn về cho phiên làm việc.
- **Đặc tả Execution Engine Foundation (`4.1-execution-engine-foundation.md`):** Đặc tả endpoint `POST /api/executions`, thuật toán duyệt đồ thị tuần tự theo các liên kết `edges` bắt đầu từ trigger node, khởi tạo bản ghi `executions` và lưu vết từng bước chạy vào `execution_node_logs`.
- **Đặc tả Node Handlers Core & Integrations (`4.2`, `4.3`):** Thiết kế interface chuẩn `NodeHandler`, Handler Registry, logic lọc dữ liệu trong bộ nhớ của `FilterHandler`, cơ chế giải mã credential an toàn và gọi Google APIs trong `GoogleSheetHandler` và `GmailHandler`.

### 3.8. Ứng dụng Agent Skills vào quy trình phát triển

Nhóm tiếp tục duy trì phương pháp phát triển hỗ trợ bởi AI thông qua bộ **agent skills của Matt Pocock** trong thư mục `.agents`:
- Sử dụng `codebase-design` và `domain-modeling` để thiết kế kiến trúc schema động và ranh giới trách nhiệm giữa các module.
- Áp dụng quy trình từ ticket/yêu cầu sang tài liệu đặc tả kỹ thuật cụ thể (`spec.md`) trước khi bắt tay vào hiện thực mã nguồn.
- Kiểm tra tuân thủ kiến trúc Modular Monolith và CQRS trên backend, bảo đảm tính độc lập giữa các module `node-library`, `connector`, `designer` và `auth`.

---

## 4. Kết quả đạt được

- Khắc phục thành công lỗi cập nhật cơ sở dữ liệu khi publish workflow và chuẩn hóa quy trình commit với Git hooks (Husky).
- Hoàn thành tài liệu quy chuẩn Config Schema (`docs/schema/rule-for-config-schema.md`) với hệ thống chú giải `x-*`, thiết lập kiến trúc mở rộng dựa trên dữ liệu.
- Hoàn thành kịch bản tổng thể và toàn bộ tài liệu đặc tả kỹ thuật cho MVP Execution Engine gồm 7 tài liệu chi tiết trong `.scratch/mvp-execution/`.
- Xây dựng thành công 2 module backend mới `node-library` và `connector` theo chuẩn Clean Architecture & CQRS, cung cấp các API lấy danh mục node và connector có xác thực JWT.
- Xây dựng kịch bản và mã nguồn `seed-mvp.ts` phục vụ khởi tạo nhanh dữ liệu danh mục mẫu độc lập cho môi trường phát triển.
- Nâng cấp toàn diện Workflow Designer trên frontend:
  - Tải và hiển thị danh mục node động từ API thay cho danh sách tĩnh.
  - Trực quan hóa node trên canvas với màu sắc, biểu tượng và hỗ trợ liên kết 4 hướng linh hoạt.
  - Tự động sinh form cấu hình thuộc tính động (`PropertiesPanel`) từ schema, hỗ trợ nút liên kết dịch vụ, dropdown tùy chọn và biểu tượng nhận diện biến động `fx`.

---

## 5. Bảng tiến độ theo nhóm yêu cầu

| Nhóm chức năng | Trạng thái | Đánh giá & Nhận xét tuần 03 |
|---|---|---|
| **Workflow Designer UI** | Đạt bước tiến lớn | Đã chuyển đổi hoàn toàn sang dữ liệu động từ Catalog API; hỗ trợ icon/màu sắc nhận diện, kết nối 4 hướng và dynamic form properties panel; cần gắn popup OAuth thật vào nút Connect. |
| **Catalog & Node Library** | Hoàn thành MVP | Đã có module backend `node-library` và `connector`, API danh mục có xác thực JWT và script `seed-mvp.ts` chuẩn hóa. |
| **Config Schema Architecture** | Hoàn thành nền tảng | Đã ban hành quy chuẩn `rule-for-config-schema.md` với các thuộc tính `x-*` phục vụ cả UI render lẫn Engine runtime. |
| **Workflow Version Management** | Ổn định MVP | Đã fix triệt để lỗi repository/mapping khi tạo version mới; bảo đảm tính bất biến của snapshot. |
| **Authentication & RBAC** | Duy trì ổn định | Hệ thống xác thực JWT, RBAC và Redis/MailHog hoạt động ổn định; các API catalog mới đều được bảo vệ bằng `JwtAuthGuard`. |
| **OAuth Integration** | Đã hoàn thành đặc tả | Đã có tài liệu thiết kế chi tiết backend API, mã hóa AES-256-GCM và luồng popup trên UI; sẵn sàng triển khai mã nguồn. |
| **Execution Engine Core** | Đã hoàn thành đặc tả | Đã đặc tả xong kiến trúc graph traversal, schema validation, cơ chế Registry và các node handler cốt lõi. |
| **DevOps & Code Quality** | Cải thiện tốt | Đã tích hợp Husky pre-commit hooks và prebuild linting cho cả frontend lẫn backend. |
| **Automated Testing** | Cần đẩy mạnh | Đã có e2e publish; cần bổ sung thêm integration test cho các endpoint Catalog mới và unit test cho Dynamic Form. |

---

## 6. Vấn đề tồn tại và hướng cải thiện

### 6.1. Luồng OAuth 2.0 mới dừng ở mức giao diện chờ

Nút "Connect [Provider]" trên Properties Panel hiện mới chỉ hiển thị thông báo mô phỏng (`alert`). Cần triển khai các endpoint OAuth ở backend, hoàn thiện tiện ích mã hóa token và xử lý sự kiện `postMessage` từ popup window trên frontend.

### 6.2. Execution Engine cần được hiện thực hóa ở mức mã nguồn

Dù đã có bộ đặc tả chi tiết và hoàn chỉnh, lõi Engine thực thi và các handler (`trigger.manual`, `logic.filter`, `integration.google_sheet.readRows`, `integration.gmail.send`) vẫn chưa được viết mã cụ thể để chạy thử nghiệm trên dữ liệu thật.

### 6.3. Chưa tích hợp Ajv để validate cấu hình node trước khi Publish

Hiện tại backend mới chỉ validate cấu trúc tổng quan của graph (trigger, action, node rời) mà chưa dùng thư viện JSON Schema (như Ajv) để đối chiếu trực tiếp dữ liệu `node.data.config` với `configSchema` của từng loại node trước khi cho phép publish.

### 6.4. Thiếu bộ kiểm thử tự động cho các API mới

Các module mới (`node-library`, `connector`) và các component form động ở frontend chưa được bổ sung kiểm thử đơn vị và tích hợp tương ứng.

---

## 7. Hướng xử lý đề xuất

- **Triển khai Google OAuth 2.0 Module:**
  - Xây dựng tiện ích mã hóa/giải mã AES-256-GCM (`encryption.service.ts`).
  - Xây dựng controller và service xử lý luồng xác thực Google OAuth 2.0 (chuyển hướng, nhận mã authorization code, trao đổi token và mã hóa).
  - Tích hợp cửa sổ popup trên frontend và lắng nghe sự kiện `oauth-success` để cập nhật trạng thái kết nối trên Properties Panel.
- **Hiện thực hóa Execution Engine:**
  - Xây dựng module `execution` trong backend: tạo API `POST /api/executions` nhận `workflowVersionId`.
  - Triển khai thuật toán duyệt graph từ trigger theo các cạnh `edges`.
  - Xây dựng interface `NodeHandler` và hệ thống `HandlerRegistry`.
  - Hiện thực `FilterHandler` xử lý lọc dữ liệu mảng theo điều kiện cấu hình.
  - Hiện thực `GoogleSheetHandler` và `GmailHandler` có cơ chế giải mã credential an toàn và nội suy biến biểu thức `{{nodeId.output}}`.
- **Tích hợp Ajv Schema Validation:** Đưa Ajv vào command handler publish workflow để xác thực cấu hình từng node dựa trên `configSchema`.

---

## 8. Kế hoạch tuần tiếp theo (Tuần 04: 28/09/2026 – 04/10/2026)

Mục tiêu tuần tiếp theo là hiện thực hóa toàn bộ luồng thực thi MVP: kết nối thành công tài khoản Google qua OAuth, hoàn thành Execution Engine core và thực hiện chạy thông suốt kịch bản tự động hóa từ Google Sheets -> Filter -> Gmail.

### Công việc dự kiến

1. **Hiện thực luồng Google OAuth 2.0:**
   - Xây dựng `encryption.service` với thuật toán AES-256-GCM.
   - Hoàn thành các API `/api/integrations/google/auth` và `/api/integrations/google/callback`.
   - Kết nối popup OAuth từ frontend Properties Panel, lưu trữ credential an toàn.
2. **Hiện thực hóa Execution Engine Foundation:**
   - Xây dựng API kích hoạt thực thi `POST /api/executions` và các entity `Execution`, `ExecutionNodeLog`.
   - Xây dựng dịch vụ duyệt graph tuần tự và ghi log trạng thái thực thi từng node.
3. **Hiện thực các Node Handlers:**
   - Hoàn thành `ManualTriggerHandler`.
   - Hoàn thành `FilterHandler` với đầy đủ các toán tử so sánh chuỗi/số.
   - Hoàn thành `GoogleSheetReadRowsHandler` kết nối Google Sheets API.
   - Hoàn thành `GmailSendHandler` hỗ trợ nội suy template `{{variables}}` và gửi email thật.
4. **Kiểm thử kịch bản trọn vẹn:**
   - Chạy thử nghiệm toàn bộ luồng từ giao diện Designer đến kết quả email thực tế nhận được trong hộp thư.
   - Bổ sung integration test cho Catalog API và unit test cho Filter Handler.

### Sản phẩm dự kiến bàn giao

- Chức năng liên kết tài khoản Google OAuth 2.0 hoạt động hoàn chỉnh qua popup.
- Execution Engine thực thi được workflow version đã publish.
- Kịch bản MVP mẫu (Google Sheets -> Filter -> Gmail) chạy thông suốt và ghi nhận log đầy đủ trong cơ sở dữ liệu.

---

## 9. Tự đánh giá tiến độ

- **Mức độ hoàn thành mục tiêu tuần:** 95%.
- **Mức độ hoàn thành toàn bộ đề tài:** khoảng 50%.

### Cơ sở ước lượng

Trong tuần 03, dự án đã có bước chuyển đổi quan trọng về mặt kiến trúc: loại bỏ hoàn toàn các cấu hình cứng (hard-code) để chuyển sang mô hình Catalog động và Schema-driven UI. Nền tảng thiết kế này bảo đảm hệ thống có tính mở rộng cao và bền vững cho các giai đoạn phát triển tiếp theo. Ngoài ra, việc hoàn thành toàn bộ tài liệu thiết kế và đặc tả chi tiết cho phân hệ Execution Engine và OAuth giúp nhóm sẵn sàng triển khai mã nguồn thực thi trong tuần tới mà không gặp vướng mắc về mặt kiến trúc.

### Đánh giá chung

Tuần 03 đã hoàn thành xuất sắc vai trò chuẩn bị hạ tầng kiến trúc, danh mục dữ liệu và giao diện động cho phân hệ thực thi. Nhóm đang bám sát tiến độ đề ra và có đầy đủ điều kiện để hoàn thành kịch bản MVP thực thi trọn vẹn trong tuần 04.

---

## 10. Nội dung ngắn gọn để đăng lên cổng

Trong tuần 03, em đã khắc phục các vấn đề liên quan đến lưu phiên bản workflow, thiết lập Git hooks (Husky, ESLint prebuild) nhằm kiểm soát chất lượng mã nguồn, và nâng cấp toàn diện phân hệ Workflow Designer theo kiến trúc hướng dữ liệu (Data-Driven Architecture). Em đã ban hành quy chuẩn Config Schema với bộ chú giải mở rộng `x-*` giúp hệ thống dễ dàng mở rộng connector/node type mới mà không cần chỉnh sửa engine hay giao diện. Ở backend, em xây dựng 2 module mới `node-library` và `connector` theo chuẩn Clean Architecture & CQRS cung cấp API danh mục node/connector bảo vệ bởi JWT, đồng thời tạo script `seed-mvp.ts` nạp dữ liệu danh mục mẫu độc lập. Ở frontend, Workflow Designer đã được loại bỏ hoàn toàn dữ liệu tĩnh, chuyển sang tải danh mục động từ API; các node trên canvas được nâng cấp hiển thị biểu tượng, màu sắc nhận diện và hỗ trợ kết nối 4 hướng linh hoạt; thanh cấu hình thuộc tính (`PropertiesPanel`) được tự động sinh form từ JSON Schema với hỗ trợ nút kết nối OAuth, dropdown tùy chọn và ký hiệu biến động `fx`. Ngoài ra, em đã hoàn thành bộ tài liệu thiết kế và đặc tả chi tiết cho luồng tích hợp Google OAuth 2.0 (mã hóa AES-256-GCM) và lõi Execution Engine với kịch bản thực tế: Manual Trigger -> Đọc Google Sheets -> Lọc dữ liệu (Filter) -> Gửi Gmail. Tuần tới, em sẽ hiện thực hóa luồng Google OAuth 2.0 qua popup, xây dựng Execution Engine cùng các Node Handler tương ứng và chạy thử nghiệm thông suốt kịch bản MVP hoàn chỉnh.
