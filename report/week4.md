# BÁO CÁO TIẾN ĐỘ TUẦN 04

## 1. Thông tin chung

- **Tên đề tài:** CrabFlowPilot – Nền tảng thiết kế và tự động hóa quy trình (Workflow Automation)
- **Loại đề tài:** Điền theo mục đã đăng ký trên cổng projects-fit.hcmute.edu.vn
- **Học kỳ:** Học kỳ 1, năm học 2026–2027
- **Tuần báo cáo:** Tuần 04
- **Thời gian báo cáo:** 28/09/2026 – 04/10/2026
- **Sinh viên thực hiện:** Nguyễn Anh Kiệt - MSSV: 23110246, Nguyễn Văn Hiếu - MSSV: 23110214
- **Giảng viên hướng dẫn:** Nguyễn Hữu Trung
- **Mã nguồn dự án:** `workflow-automation`
- **Ngày chốt số liệu:** 04/10/2026

---

## 2. Mục tiêu của tuần

Trọng tâm của tuần 04 là hoàn thiện toàn diện bộ tài liệu đặc tả kỹ thuật chi tiết cho hai phân hệ cốt lõi: **Google OAuth 2.0 Integration** (Thư mục `.scratch/mvp-execution/3-oauth-integration`) và **MVP Execution Engine** (Thư mục `.scratch/mvp-execution/4-execution`), đồng thời giải quyết triệt để bài toán kiến trúc về xung đột phiên bản thông qua việc hiện thực hóa tính năng **Khôi phục phiên bản an toàn (Workflow Version Restore - Zero Data Loss)** và kiểm thử tự động End-to-End.

Các mục tiêu cụ thể gồm:
1. **Hoàn thiện bộ đặc tả tích hợp Google OAuth 2.0:** Xây dựng kiến trúc bảo mật token với AES-256-GCM, luồng API xác thực popup và cập nhật trạng thái liên kết tài khoản linh hoạt trên frontend.
2. **Hoàn thiện bộ đặc tả Execution Engine MVP:** Đặc tả chi tiết lõi engine duyệt graph tuần tự, hệ thống Handler Registry, các bộ xử lý node cốt lõi (`trigger.manual`, `logic.filter`), bộ tích hợp dịch vụ ngoài (`integration.google_sheet.readRows`, `integration.gmail.send`) và giao diện kích hoạt thực thi Run UI.
3. **Hiện thực hóa và kiểm thử End-to-End tính năng Khôi phục phiên bản (Version Restore):** Giải quyết vấn đề mất bản nháp chưa xuất bản khi khôi phục phiên bản cũ, cung cấp 3 chiến lược bảo vệ dữ liệu linh hoạt và xây dựng bộ giao diện chuẩn `shadcn/ui`.
4. **Nâng cấp hạ tầng công nghệ Frontend:** Tích hợp trực tiếp `@tanstack/react-query` và chuẩn hóa toàn bộ các UI primitive với `shadcn/ui`.

---

## 3. Nội dung công việc đã thực hiện

### 3.1. Đặc tả phân hệ Google OAuth 2.0 Integration (`3-oauth-integration`)

Nhóm đã hoàn thiện trọn vẹn 3 tài liệu đặc tả kỹ thuật làm cơ sở bảo mật và kết nối dịch vụ Google cho kịch bản tự động hóa:

#### a. Đặc tả Backend API & Lưu trữ Credential an toàn (`3.1-oauth-backend-api.md`)
- **Dịch vụ mã hóa (`encryption.service.ts`):** Sử dụng thuật toán chuẩn công nghiệp **AES-256-GCM** với khóa bí mật 256-bit được cấp từ biến môi trường (`ENCRYPTION_KEY`). Mỗi chuỗi mã hóa bao gồm `IV (Initialization Vector) + Auth Tag + Ciphertext` dưới định dạng chuỗi Hex, bảo đảm bí mật và toàn vẹn dữ liệu token OAuth (Access Token & Refresh Token).
- **Endpoint khởi tạo xác thực (`GET /api/integrations/google/auth`):** Tạo đường dẫn Google Authorization URL kèm các phạm vi truy cập (Scopes) cần thiết (`spreadsheets.readonly`, `gmail.send`, `userinfo.email`), tích hợp cơ chế bảo vệ CSRF qua tham số `state` có thời hạn lưu trong Redis/Session.
- **Endpoint nhận Callback (`GET /api/integrations/google/callback`):** Nhận `code` từ Google, trao đổi lấy bộ token, mã hóa và lưu trữ vào bảng `connector_credentials` với trạng thái kiểm tra kết nối (`last_test_status = SUCCESS`). Trả về trang HTML tự động gửi thông điệp `postMessage` chứa `credentialId` và đóng popup an toàn.

#### b. Đặc tả tích hợp Frontend & Popup liên kết tài khoản (`3.2-oauth-frontend-integration.md`)
- **Cửa sổ Popup độc lập:** Nút "Connect Google Account" trên thanh thuộc tính (`PropertiesPanel`) mở cửa sổ popup kích thước chuẩn $500 \times 600$ căn giữa màn hình.
- **Lắng nghe sự kiện tương tác (`postMessage`):** Frontend đăng ký lắng nghe sự kiện `message`, kiểm tra `origin` an toàn; khi nhận tín hiệu `OAUTH_SUCCESS`, tự động ghi nhận `credentialId` vào trường cấu hình của node và cập nhật nhãn tài khoản đã kết nối mà không cần tải lại trang.

#### c. Luồng nghiệp vụ và bảo mật OAuth 2.0 (`oauth-flow.md`)
- Vẽ sơ đồ trình tự tương tác (Sequence Diagram) chi tiết giữa Người dùng - Frontend Designer - Backend API - Google OAuth Server - Cơ sở dữ liệu Postgres.
- Xác định rõ các giải pháp phòng chống tấn công CSRF, Clickjacking và rò rỉ token qua URL/Logs.

---

### 3.2. Đặc tả phân hệ Execution Engine MVP (`4-execution`)

Phân hệ thực thi quy trình được chia nhỏ thành 4 tài liệu đặc tả có tính module hóa cao:

#### a. Nền tảng Execution Engine & Duyệt đồ thị (`4.1-execution-engine-foundation.md`)
- **Endpoint thực thi (`POST /api/executions`):** Tiếp nhận `workflowVersionId` và tham số đầu vào. Khởi tạo một phiên chạy mới trong bảng `executions` với trạng thái ban đầu là `RUNNING`.
- **Thuật toán duyệt đồ thị tuần tự (Graph Traversal):** Bắt đầu từ node kích hoạt (`trigger`), xác định luồng đi qua danh sách các liên kết `edges` trong `definition`, thực thi tuần tự từng node theo mô hình đường ống (Pipeline Dataflow) — đầu ra (`output`) của node trước trở thành ngữ cảnh đầu vào cho các node tiếp theo.
- **Ghi nhật ký chi tiết (`execution_node_logs`):** Mỗi bước chạy đều lưu trữ đầy đủ `status` (`SUCCESS`/`FAILED`), thời gian thực thi `durationMs`, dữ liệu đầu vào `input`, dữ liệu kết quả `output`, và thông tin lỗi `errorMessage`/`errorStack` khi có sự cố.

#### b. Khung Handler chuẩn & Bộ xử lý cốt lõi (`4.2-execution-node-handlers-core.md`)
- **Giao diện chuẩn `NodeHandler`:** Quy định phương thức `execute(context: ExecutionContext): Promise<NodeOutput>`, tách biệt hoàn toàn logic nghiệp vụ của từng node khỏi lõi điều phối của Engine.
- **Cơ chế Handler Registry:** Quản lý danh mục các handler theo `nodeKey` (Dependency Injection), cho phép đăng ký thêm node mới mà không phải sửa Engine.
- **`ManualTriggerHandler` (`trigger.manual`):** Tiếp nhận dữ liệu truyền vào từ người dùng hoặc trả về payload mặc định làm điểm khởi đầu luồng chạy.
- **`FilterHandler` (`logic.filter`):** Xử lý lọc dữ liệu mảng trong bộ nhớ. Hỗ trợ các toán tử so sánh chuỗi và số linh hoạt: `equals`, `not_equals`, `greater_than`, `less_than`, `contains` trên các trường dữ liệu tùy biến.

#### c. Tích hợp thực thi dịch vụ ngoài (`4.3-execution-integrations.md`)
- **Nội suy biểu thức động (Expression Interpolation):** Xây dựng bộ giải quyết biểu thức runtime hỗ trợ cú pháp `{{nodeId.output.field}}`, tự động trích xuất giá trị từ các bước chạy trước và thay thế vào cấu hình node tiếp theo.
- **`GoogleSheetReadRowsHandler` (`integration.google_sheet.readRows`):** Tự động giải mã token người dùng từ bảng `connector_credentials`, khởi tạo kết nối Google Sheets API v4, đọc phạm vi ô tính (`range`) và chuyển đổi thành danh sách đối tượng JSON.
- **`GmailSendHandler` (`integration.gmail.send`):** Giải mã token OAuth, biên dịch tiêu đề và nội dung thư từ biểu thức động, đóng gói định dạng RFC 2822 chuẩn mã hóa Base64URL và gửi email thông qua Google Gmail API.

#### d. Giao diện quản lý phiên bản và kích hoạt Run UI (`4.4-execution-run-ui.md`)
- Đặc tả các API đọc danh sách phiên bản: `GET /api/workflows/:id/versions` (sắp xếp mới nhất lên đầu) và `GET /api/workflows/:id/versions/:versionId` (chi tiết definition).
- Thiết kế luồng điều hướng Frontend: Trang danh sách workflow -> Danh sách phiên bản -> Chi tiết phiên bản kèm nút **"Run"** kích hoạt thực thi trực tiếp và hiển thị bảng kết quả log từng node.

---

### 3.3. Hiện thực hóa và kiểm thử End-to-End tính năng Khôi phục phiên bản (Version Restore)

Song song với việc hoàn thành bộ đặc tả, nhóm đã trực tiếp giải quyết vấn đề kỹ thuật phát sinh khi khôi phục phiên bản cũ làm mất bản nháp dở dang:

1. **Thiết kế chiến lược Zero-Data-Loss (Phương án A cải tiến):**
   - Đưa ra 3 lựa chọn trực quan cho người dùng:
     - `PUBLISH_THEN_RESTORE` (Khuyến nghị): Xuất bản bản nháp dở dang thành Version $V_{n+1}$ trước, sau đó mới nạp $V_k$ vào bản nháp.
     - `BACKUP_THEN_RESTORE`: Tách bản nháp dở dang sang một Workflow backup mới.
     - `OVERWRITE`: Hủy bỏ bản nháp và ghi đè trực tiếp.
2. **Hiện thực hóa Backend (NestJS, Prisma, CQRS):**
   - Xây dựng DTO `RestoreVersionDto` và Command Handler `RestoreVersionHandler`.
   - Toàn bộ thao tác nạp dữ liệu và tạo backup/version mới được bọc an toàn trong `prisma.$transaction`.
   - Bổ sung endpoint `GET /api/workflows/:id/draft/status` kiểm tra dirty state của bản nháp.
   - Bổ sung endpoint `GET /api/workflows/:id/versions` phục vụ truy xuất lịch sử.
3. **Hiện thực hóa Frontend với `shadcn/ui`:**
   - Cài đặt và chuẩn hóa các component: `dialog`, `radio-group`, `alert`, `badge`, `button`.
   - Xây dựng modal cảnh báo thông minh [`RestoreConflictDialog.tsx`](file:///d:/New%20folder/workflow-automation/frontend/src/features/workflow/components/RestoreConflictDialog.tsx).
   - Tích hợp hộp thoại lịch sử [`VersionHistoryDialog.tsx`](file:///d:/New%20folder/workflow-automation/frontend/src/features/workflow/components/VersionHistoryDialog.tsx) và nút "Lịch sử phiên bản" trên thanh công cụ của Designer.
   - Tự động nạp lại graph trên React Flow canvas ngay khi khôi phục thành công.
4. **Kiểm thử tự động End-to-End (E2E):**
   - Xây dựng bộ kiểm thử tích hợp toàn diện [`restore-version.e2e-spec.ts`](file:///d:/New%20folder/workflow-automation/monolith-backend/apps/api/test/restore-version.e2e-spec.ts).
   - Kết quả: **PASS 100%** cả 3 kịch bản `OVERWRITE`, `PUBLISH_THEN_RESTORE` và `BACKUP_THEN_RESTORE`.

---

## 4. Kết quả đạt được

- Hoàn thành đầy đủ bộ 3 tài liệu đặc tả kỹ thuật phân hệ **Google OAuth 2.0 Integration** trong thư mục `.scratch/mvp-execution/3-oauth-integration/`.
- Hoàn thành đầy đủ bộ 4 tài liệu đặc tả kỹ thuật phân hệ **MVP Execution Engine** trong thư mục `.scratch/mvp-execution/4-execution/`.
- Ban hành bộ đặc tả kiến trúc và thiết kế [`docs/specs/workflow-restore-version/`](file:///d:/New%20folder/workflow-automation/docs/specs/workflow-restore-version) (gồm `spec.md`, `design.md`, `task.md`).
- Triển khai mã nguồn hoàn chỉnh tính năng Khôi phục phiên bản trên cả Backend (NestJS CQRS) và Frontend (`shadcn/ui`, TanStack Query).
- Bộ kiểm thử tự động e2e vượt qua thành công, bảo đảm tính toàn vẹn dữ liệu (Zero Data Loss) và không có lỗi biên dịch trên toàn bộ mã nguồn.

---

## 5. Bảng tiến độ theo nhóm yêu cầu

| Nhóm chức năng | Trạng thái | Đánh giá & Nhận xét tuần 04 |
|---|---|---|
| **Google OAuth Specification** | Hoàn thành đặc tả 100% | Đã có tài liệu API, luồng popup và kiến trúc mã hóa AES-256-GCM chi tiết, sẵn sàng viết code. |
| **Execution Engine Specification** | Hoàn thành đặc tả 100% | Đã đặc tả trọn vẹn Graph traversal, Handler registry, Filter logic, Google Sheets & Gmail API integration và Run UI. |
| **Workflow Version Restore** | Hoàn thành & Test E2E | Đã hiện thực hóa toàn bộ backend transaction, frontend shadcn/ui modal và vượt qua kiểm thử e2e. |
| **Frontend UI System** | Nâng cấp toàn diện | Đã tích hợp `@tanstack/react-query`, cài đặt đầy đủ các component `shadcn/ui` (`dialog`, `radio-group`, `alert`, `badge`, `button`) theo đúng quy chuẩn dự án. |
| **Backend Architecture** | Ổn định & Mở rộng | Tiếp tục duy trì chuẩn Modular Monolith, Clean Architecture và CQRS cho module `designer`. |

---

## 6. Vấn đề tồn tại và hướng cải thiện

### 6.1. Tiến hành hiện thực hóa mã nguồn cho các Node Handler
Dù bộ đặc tả của `3-oauth-integration` và `4-execution` đã rất chi tiết, các handler thực tế (`GoogleSheetReadRowsHandler`, `GmailSendHandler`, `FilterHandler`) và dịch vụ mã hóa `encryption.service.ts` cần được triển khai trực tiếp vào mã nguồn backend trong tuần tới.

### 6.2. Hoàn thiện giao diện Run UI theo đặc tả 4.4
Cần hoàn thiện các trang danh sách workflow (`/workflows`) và trang chi tiết phiên bản (`/workflows/:id/versions/:versionId`) để hiển thị nút Run và bảng log trực quan.

---

## 7. Hướng xử lý đề xuất

1. **Triển khai Google OAuth Backend & Frontend:** Viết mã nguồn `encryption.service.ts` và 2 endpoint `/api/integrations/google/auth` và `/callback`; gắn sự kiện mở popup vào nút Connect của `PropertiesPanel`.
2. **Xây dựng module `execution` ở Backend:** Tạo controller `executions.controller.ts`, service duyệt đồ thị và đăng ký các handler vào `HandlerRegistry`.
3. **Xây dựng màn hình Run UI ở Frontend:** Hoàn thiện bảng hiển thị log trực tiếp từ bảng `execution_node_logs` khi chạy thử nghiệm kịch bản Google Sheets -> Filter -> Gmail.

---

## 8. Kế hoạch tuần tiếp theo (Tuần 05: 05/10/2026 – 11/10/2026)

### Công việc dự kiến
1. Triển khai mã nguồn Google OAuth 2.0 (Backend service mã hóa + Frontend popup).
2. Hiện thực hóa Execution Engine core và các Node Handlers (`trigger.manual`, `logic.filter`, `integration.google_sheet.readRows`, `integration.gmail.send`).
3. Hoàn thiện giao diện Run UI và hiển thị log thực thi từng node theo đặc tả 4.4.
4. Chạy thử nghiệm thực tế toàn bộ kịch bản MVP thông suốt từ việc đọc Google Sheets thật, lọc dữ liệu và gửi Gmail thật đến hộp thư.

### Sản phẩm dự kiến bàn giao
- Module `integrations` có luồng Google OAuth hoạt động thực tế.
- Execution Engine thực thi và ghi nhận log thành công vào database.
- Email thật được gửi thành công từ kịch bản chạy thử nghiệm.

---

## 9. Tự đánh giá tiến độ

- **Mức độ hoàn thành mục tiêu tuần:** 100%.
- **Mức độ hoàn thành toàn bộ đề tài:** khoảng 65%.

### Đánh giá chung
Tuần 04 đã hoàn thành xuất sắc mục tiêu kép: Hoàn thiện toàn bộ hệ thống đặc tả kỹ thuật chi tiết cho hai phân hệ then chốt (OAuth 2.0 và Execution Engine) và giải quyết trọn vẹn tính năng Khôi phục phiên bản bảo vệ dữ liệu với kiểm thử e2e chuẩn chỉ. Toàn bộ nền tảng kiến trúc và đặc tả đã sẵn sàng 100% để nhóm bắt tay vào viết mã nguồn thực thi trong tuần tới.

---

## 10. Nội dung ngắn gọn để đăng lên cổng

Trong tuần 04, em đã hoàn thành toàn diện bộ tài liệu đặc tả kỹ thuật cho hai phân hệ cốt lõi: Google OAuth 2.0 Integration (mã hóa token AES-256-GCM, luồng popup an toàn và liên kết tài khoản linh hoạt) và MVP Execution Engine (thuật toán duyệt đồ thị tuần tự, hệ thống Handler Registry, các bộ xử lý node Trigger/Filter/Google Sheets/Gmail và giao diện Run UI). Đồng thời, em đã hiện thực hóa và kiểm thử tự động End-to-End thành công tính năng Khôi phục phiên bản an toàn (Workflow Version Restore) theo cơ chế Zero Data Loss với 3 chiến lược bảo vệ bản nháp (`PUBLISH_THEN_RESTORE`, `BACKUP_THEN_RESTORE`, `OVERWRITE`), tích hợp bộ giao diện modal trực quan theo chuẩn `shadcn/ui` và `@tanstack/react-query`. Tuần tới, em sẽ tiến hành viết mã nguồn thực thi cho Execution Engine và hoàn thành kịch bản tự động hóa thực tế từ Google Sheets -> Filter -> Gmail.
