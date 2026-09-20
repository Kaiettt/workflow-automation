# BÁO CÁO TIẾN ĐỘ TUẦN 01

## 1. Thông tin chung

- **Tên đề tài:** CrabFlowPilot – Nền tảng thiết kế và tự động hóa quy trình (Workflow Automation)
- **Loại đề tài:** Điền theo mục đã đăng ký trên cổng projects-fit.hcmute.edu.vn
- **Học kỳ:** Học kỳ 1, năm học 2026–2027
- **Tuần báo cáo:** Tuần 01
- **Thời gian báo cáo:** 07/09/2026 – 13/09/2026
- **Sinh viên thực hiện:** Nguyễn Anh Kiệt - MSSV: 23110246, Nguyễn Văn Hiếu - MSSV: 23110214
- **Giảng viên hướng dẫn:** Nguyễn Hữu Trung
- **Mã nguồn dự án:** `workflow-automation`
- **Ngày chốt số liệu:** 13/09/2026

> **Lưu ý:** Cần điền thông tin cá nhân và điều chỉnh số tuần theo lịch chính thức trên cổng trước khi đăng.

---

## 2. Mục tiêu của tuần

Mục tiêu chính của tuần là phân tích bài toán, xác định phạm vi đề tài và xây dựng nền tảng ban đầu cho hệ thống CrabFlowPilot. Các mục tiêu cụ thể gồm:

- Phân tích yêu cầu và xây dựng tài liệu PRD, SRS cho hệ thống.
- Đề xuất kiến trúc tổng thể, thiết kế cơ sở dữ liệu và đặc tả Workflow Designer.
- Khởi tạo cấu trúc mã nguồn frontend, backend, Prisma và môi trường PostgreSQL bằng Docker Compose.
- Hiện thực các chức năng nền tảng của Workflow Designer và API lưu bản nháp.
- Tổng hợp các vấn đề kỹ thuật còn tồn tại và lập kế hoạch cho tuần kế tiếp.

---

## 3. Nội dung công việc đã thực hiện

### 3.1. Phân tích yêu cầu và xác định phạm vi sản phẩm

Trong tuần, em đã phân tích bài toán và xây dựng bộ tài liệu PRD, SRS cho CrabFlowPilot. Hệ thống được định hướng là nền tảng cho phép người dùng xây dựng workflow bằng giao diện trực quan, cấu hình các node và thực thi workflow thông qua các trigger.

Phạm vi chức năng chính được xác định gồm:

- Workflow Designer: tạo, chỉnh sửa, kéo thả node, kết nối node, lưu nháp, kiểm tra hợp lệ và publish.
- Node Library: Trigger, Logic, Data Processing và Integration.
- Connector Framework: HTTP, Webhook, PostgreSQL, Gmail, Google Sheets, Google Drive, Slack và OpenAI.
- Workflow Execution Engine: tuần tự, rẽ nhánh, song song, retry, timeout và xử lý lỗi.
- Execution Monitor và Workflow Logs.
- Workflow Version Management: lưu phiên bản, so sánh và rollback.

CrabFlowPilot AI được xác định là định hướng giai đoạn sau, không phải hạng mục ưu tiên của MVP hiện tại.

Đồng thời, em giới hạn phạm vi MVP, chưa đưa vào giai đoạn này các chức năng:

- Distributed Engine
- Multi-region
- Marketplace
- Cộng tác thời gian thực
- Thư viện connector quy mô lớn

---

### 3.2. Xây dựng kiến trúc tổng thể

Em đã đề xuất backend theo mô hình **Modular Monolith**, kết hợp **Clean Architecture**, **Domain-Driven Design (DDD)** ở mức module và **CQRS**.

Mỗi module được chia thành các lớp:

- Domain
- Application
- Infrastructure
- Presentation

Cách tổ chức này giúp tách biệt nghiệp vụ, giảm phụ thuộc trực tiếp vào Prisma và tạo điều kiện tách microservice khi hệ thống phát triển.

#### Công nghệ được lựa chọn

##### Frontend

- React 19
- TypeScript
- Vite
- React Flow
- Zustand
- Tailwind CSS
- shadcn/base-ui

##### Backend

- NestJS 11
- TypeScript
- CQRS
- Swagger
- Prisma ORM

##### Database

- PostgreSQL 17
- Prisma Migration

##### Hạ tầng cục bộ

- Docker Compose cho PostgreSQL

---

### 3.3. Thiết kế cơ sở dữ liệu

Em đã thiết kế Prisma schema và tạo hai migration cho cơ sở dữ liệu.

Các nhóm bảng chính gồm:

- `users`: người dùng và vai trò.
- `workflows`: thông tin định danh và trạng thái workflow.
- `workflow_drafts`: bản đang chỉnh sửa, mỗi workflow có tối đa một draft.
- `workflow_versions`: các phiên bản đã publish, lưu bất biến theo số phiên bản.
- `node_type_definitions`: định nghĩa loại node, schema cấu hình, input/output và thông tin hiển thị.
- `connectors`, `connector_credentials`: connector và thông tin xác thực được mã hóa.
- `executions`: một lần thực thi workflow.
- `execution_node_logs`: trạng thái, input, output, lỗi, retry và thời gian của từng node.

Em tách `workflow_drafts` khỏi `workflow_versions` vì:

- Draft có thể chưa hợp lệ và được cập nhật liên tục.
- Version chỉ được tạo sau khi validate thành công.
- Version phải giữ nguyên để phục vụ truy vết, rollback và tái hiện chính xác logic đã chạy.

---

### 3.4. Xây dựng Workflow Designer trên Frontend

Em đã xây dựng phiên bản MVP của Workflow Designer với các thành phần sau:

- Màn hình khởi tạo CrabFlowPilot và nút tạo workflow mới.
- Gọi API tạo workflow trước khi mở trình thiết kế.
- Bố cục trình thiết kế gồm Sidebar, Canvas và Properties Panel.
- Danh mục mẫu gồm:
  - Schedule
  - Google Calendar
  - If
  - Format Text
  - Send Email
- Kéo node từ Sidebar vào Canvas.
- Di chuyển node và kết nối các node bằng React Flow.
- Hai giao diện node riêng:
  - Trigger Node
  - Action Node
- Chọn node và chỉnh sửa cấu hình cơ bản ở Properties Panel.
- Quản lý `selectedNodeId` và trạng thái lưu bằng Zustand.
- Tải draft khi mở Designer.
- Tự động lưu draft sau 2 giây không có thay đổi.
- Hiển thị trạng thái:
  - `Saving...`
  - `Saved`

Phiên bản hiện tại mới đáp ứng luồng thiết kế cơ bản.

Các tính năng chưa hoàn thiện:

- Dữ liệu node vẫn được hard-code trên frontend.
- Chưa sinh form tự động theo `config_schema`.
- Chưa lưu viewport từ React Flow.
- Chưa validate trước khi publish.
- Chưa publish workflow.
- Chưa có danh sách workflow.
- Chưa có tìm kiếm node.
- Chưa có thông báo lỗi thân thiện.

---

### 3.5. Xây dựng Designer Module trên Backend

Đã hiện thực các API:

```http
POST /workflows
GET /workflows/:id/draft
PUT /workflows/:id/draft
```

Các thành phần đã xây dựng:

- DTO cho tạo workflow và lưu draft.
- Command Handler cho CreateWorkflow và SaveDraft.
- Query Handler cho GetWorkflowDraft.
- Repository abstraction ở domain.
- Prisma repository ở infrastructure.
- Mapper chuyển đổi Prisma model sang domain entity.
- DesignerModule được tích hợp vào hệ thống API.
- Swagger UI tại:

```text
/api/docs
```

- CORS được bật cho frontend.

Chức năng lưu draft sử dụng cơ chế **upsert** và kiểm tra workflow cha tồn tại trước khi lưu.

Điều này bảo đảm:

- Mỗi workflow chỉ có một bản nháp.
- Hỗ trợ cơ chế autosave từ frontend.

---

### 3.6. Thiết kế ban đầu cho Execution Module

Đã thiết kế vòng đời thực thi node gồm:

1. Nội suy dữ liệu.
2. Lấy credential.
3. Chạy node.
4. Retry/Error Handling.
5. Chuẩn hóa output.
6. Ghi log.

Hiện trạng:

- Đã khởi tạo cấu trúc thư mục.
- Đã xác định các thành phần cần triển khai.
- Chưa hiện thực nghiệp vụ.
- Chưa tích hợp vào `AppModule`.

Các nhóm yêu cầu:

- FR-EX
- FR-EM
- FR-LG

Hiện mới hoàn thành ở mức phân tích, thiết kế và chuẩn bị schema dữ liệu.

---

### 3.7. Quản lý mã nguồn và tích hợp công việc

Mã nguồn được quản lý bằng Git với **17 commit** trong giai đoạn khởi tạo từ **17/07/2026 đến 25/07/2026**.

Các mốc chính:

#### 17/07/2026

- Khởi tạo cấu trúc frontend.
- Khởi tạo cấu trúc backend.
- Thiết lập nền tảng dự án.

#### 18/07/2026

- Bổ sung schema.
- Bổ sung dữ liệu mẫu.
- Hoàn thiện ghi chú kiến trúc.

#### 22/07/2026

- Hiện thực lưu workflow draft theo CQRS và Clean Architecture.
- Merge Pull Request #1.

#### 25/07/2026

- Cập nhật lớn mã nguồn và tài liệu.
- Merge Pull Request #2.
- Merge Pull Request #3.

Các thay đổi được phát triển trên nhánh riêng và tích hợp thông qua Pull Request nhằm bảo đảm khả năng kiểm soát thay đổi mã nguồn.

---

## 4. Kết quả đạt được

- Hoàn thành tài liệu yêu cầu và xác định phạm vi chức năng, phi chức năng của CrabFlowPilot.
- Xây dựng kiến trúc backend và luồng phụ thuộc giữa Controller, CQRS Handler, Domain Repository và Prisma Repository.
- Xây dựng Workflow Designer MVP với các thao tác cốt lõi trên canvas và cơ chế autosave.
- Xây dựng các API nền tảng để tạo workflow, lấy draft và lưu draft.
- Thiết kế schema PostgreSQL cho các phân hệ Designer, Versioning, Connector, Execution và Logging.
- Xác định các hạng mục còn thiếu để đưa vào kế hoạch phát triển tiếp theo.

---

## 5. Bảng tiến độ theo nhóm yêu cầu

| Nhóm | Trạng thái | Nhận xét |
|--------|--------|--------|
| Tài liệu PRD/SRS/Kiến trúc | Hoàn thành bản đầu | Đã xác định phạm vi, yêu cầu và phương án kiến trúc ban đầu |
| Cơ sở dữ liệu | Đã thiết kế và có migration | Chưa có dữ liệu seed và cần kiểm thử migration trên môi trường sạch |
| Workflow Designer UI | Đã có MVP | Có kéo thả, kết nối, cấu hình cơ bản và autosave; chưa có validate/publish |
| Designer Backend | Hoàn thành một phần | Có create/get draft/save draft; thiếu update metadata, validate và publish |
| Node Library | Prototype | Danh sách node đang hard-code, chưa tải từ database và chưa có tìm kiếm/phân nhóm đầy đủ |
| Connector Framework | Mới có schema/tài liệu | Chưa có service, API, mã hóa credential và connector runner |
| Execution Engine | Chưa hiện thực | Các tệp khung đang rỗng |
| Execution Monitor | Chưa hiện thực | Mới có yêu cầu và schema |
| Workflow Logs | Chưa hiện thực | Mới có yêu cầu và schema |
| Version Management | Mới có schema/tài liệu | Chưa có publish, compare và rollback |
| Automated Testing | Rất hạn chế | Chỉ có test mặc định "Hello World"; chưa có test nghiệp vụ |
| DevOps | Một phần | Có Docker Compose cho PostgreSQL; Dockerfile frontend/backend đang rỗng, chưa có CI/CD |

---

## 6. Vấn đề tồn tại và hướng cải thiện

### 6.1. Sai lệch cấu hình môi trường

- Docker Compose mở PostgreSQL ở cổng `5432`.
- Backend `.env.example` sử dụng `5433`.

Nếu giữ nguyên, backend sẽ không kết nối được database.

Ngoài ra:

- Frontend fallback URL:

```text
http://localhost:8080/api
```

- Backend chưa cấu hình global prefix `/api`.

Điều này có thể dẫn đến sai endpoint khi thiếu file `.env`.

---

### 6.2. Dữ liệu Owner đang hard-code

Frontend gửi một UUID owner cố định.

API cũng tạo UUID mặc định khi không có owner.

Do bảng `workflows.owner_id` có khóa ngoại tới bảng `users`, quá trình tạo workflow sẽ thất bại nếu user tương ứng chưa tồn tại.

---

### 6.3. Validation DTO chưa được kích hoạt toàn cục

DTO đã sử dụng:

- class-validator

Tuy nhiên:

```ts
ValidationPipe
```

chưa được bật trong `main.ts`.

Do đó dữ liệu đầu vào hiện chưa được kiểm tra đầy đủ.

---

### 6.4. Luồng tạo workflow và lấy draft chưa nhất quán

Hiện tại:

- Tạo workflow chưa sinh draft rỗng.
- Lần GET draft đầu tiên trả về `404`.

Frontend xử lý bằng cách quy đổi thành graph rỗng.

Đây là giải pháp tạm thời cho prototype.

---

### 6.5. Thiếu Optimistic Concurrency

Tài liệu thiết kế đã đề xuất sử dụng `updated_at`.

Tuy nhiên API hiện tại chưa:

- Nhận concurrency token.
- Kiểm tra xung đột cập nhật.

Nguy cơ mất dữ liệu khi mở nhiều tab vẫn tồn tại.

---

### 6.6. Chưa có kiểm thử nghiệp vụ

Hiện chỉ tồn tại test mặc định:

```text
Hello World!
```

Chưa có:

- Unit test
- Integration test
- Repository test
- Workflow test
- Autosave test

---

### 6.7. Hạ tầng triển khai chưa hoàn chỉnh

- Dockerfile frontend đang rỗng.
- Dockerfile backend đang rỗng.
- Chưa có Redis.
- Chưa có Queue.
- Chưa có GitHub Actions.

Do đó môi trường triển khai chưa đồng nhất.

---

## 7. Hướng xử lý đề xuất

- Đồng bộ cổng PostgreSQL giữa Docker Compose và backend `.env.example`.
- Chuẩn hóa API base URL và global prefix.
- Bổ sung tài liệu chạy hệ thống tại README.
- Seed dữ liệu user hoặc xây dựng cơ chế Development User.
- Bật ValidationPipe kèm:
  - whitelist
  - transform
- Tạo workflow và draft rỗng trong cùng transaction.
- Hoàn thiện validate/publish trước khi phát triển Execution Engine.
- Bổ sung test cho:
  - Create Workflow
  - Get Draft
  - Save Draft
- Chuyển Node Library từ hard-code sang dữ liệu từ `node_type_definitions`.

---

## 8. Kế hoạch tuần tiếp theo

Mục tiêu tuần tiếp theo là ổn định luồng Workflow Designer từ đầu đến cuối trước khi phát triển Execution Engine.

### Công việc dự kiến

- Sửa và thống nhất cấu hình database/API.
- Tạo seed dữ liệu phát triển:
  - User
  - Connector
  - Node Type
- Hoàn thiện transaction tạo workflow kèm draft rỗng.
- Bật validation toàn cục.
- Chuẩn hóa response và error handling.
- Hoàn thiện lưu viewport.
- Hoàn thiện xử lý lỗi autosave.
- Thiết kế và hiện thực validate graph:
  - Có Trigger
  - Không có node mồ côi
  - Đủ cấu hình bắt buộc
- Viết test cho:
  - Create Workflow
  - Get Draft
  - Save Draft
- Cập nhật README.
- Bổ sung hướng dẫn chạy và kiểm thử.

### Sản phẩm dự kiến bàn giao

- Môi trường local chạy đồng nhất bằng tài liệu hướng dẫn.
- Có dữ liệu seed phục vụ demo.
- Luồng tạo workflow → mở Designer → chỉnh sửa → autosave hoạt động ổn định.
- Có validate graph cơ bản.
- Có bộ test nghiệp vụ tối thiểu cho Designer Module.

---

## 9. Tự đánh giá tiến độ

- **Mức độ hoàn thành mục tiêu tuần:** 100%.
- **Mức độ hoàn thành toàn bộ đề tài:** khoảng 20–25%.

### Cơ sở ước lượng

Tài liệu, schema và Workflow Designer MVP đã được xây dựng.

Tuy nhiên các hạng mục có khối lượng lớn vẫn chưa được hiện thực:

- Execution Engine
- Connector Framework
- Execution Monitor
- Workflow Logs
- Version Management

### Đánh giá chung

Dự án đã có nền tảng kiến trúc và Prototype Workflow Designer tương đối rõ ràng.

Ưu tiên tiếp theo là:

1. Ổn định luồng Designer.
2. Hoàn thiện Publish Workflow.
3. Bổ sung kiểm thử.
4. Chuẩn hóa môi trường phát triển.
5. Chuẩn bị cho Execution Engine.

---

## 10. Nội dung ngắn gọn để đăng lên cổng

Trong tuần 01, em đã phân tích yêu cầu và xây dựng các tài liệu PRD, SRS, kiến trúc backend, thiết kế cơ sở dữ liệu và đặc tả Workflow Designer cho CrabFlowPilot. Em lựa chọn React, TypeScript và React Flow cho frontend; NestJS, CQRS, Clean Architecture và Prisma cho backend; PostgreSQL làm cơ sở dữ liệu. Về hiện thực, em đã xây dựng Workflow Designer MVP với chức năng tạo workflow, kéo thả, di chuyển và kết nối node, chọn và cấu hình node, tải bản nháp và tự động lưu sau 2 giây. Backend đã có các API `POST /workflows`, `GET /workflows/:id/draft` và `PUT /workflows/:id/draft`; schema dữ liệu đã được thiết kế cho workflow, draft, version, connector, execution và log. Các chức năng validate/publish, thư viện node động, Connector Framework, Execution Engine, Monitor, Logs và Version Management sẽ được tiếp tục triển khai. Một số vấn đề kỹ thuật hiện tại gồm cấu hình cổng PostgreSQL chưa thống nhất, API fallback chưa khớp global prefix, `ownerId` đang được khai báo cố định, chưa bật ValidationPipe, chưa có dữ liệu seed và còn thiếu kiểm thử nghiệp vụ. Tuần tiếp theo, em sẽ ưu tiên đồng bộ cấu hình, tạo dữ liệu seed, hoàn thiện luồng tạo workflow kèm draft, bổ sung validation, kiểm thử các API Designer và chuẩn bị chức năng validate/publish workflow.