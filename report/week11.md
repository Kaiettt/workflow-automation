# BÁO CÁO TIẾN ĐỘ TUẦN 11

## 1. Thông tin chung

- **Tên đề tài:** CrabFlowPilot – Nền tảng thiết kế và tự động hóa quy trình (Workflow Automation)
- **Học kỳ:** Học kỳ 1, năm học 2026–2027
- **Tuần báo cáo:** Tuần 11
- **Thời gian báo cáo:** 16/11/2026 – 22/11/2026
- **Sinh viên thực hiện:**
  - Nguyễn Anh Kiệt – MSSV: 23110246
  - Nguyễn Văn Hiếu – MSSV: 23110214
- **Giảng viên hướng dẫn:** ThS. Nguyễn Hữu Trung
- **Mã nguồn dự án:** `workflow-automation`
- **Nhánh làm việc:** `master`
- **Ngày chốt số liệu:** 22/11/2026

---

## 2. Mục tiêu của tuần

Trong Tuần 11, nhóm tập trung tiếp tục hoàn thiện nền tảng quản trị hệ thống (Admin Management), mở rộng khả năng kiểm soát các thành phần cấu thành workflow và nâng cao chất lượng mã nguồn cũng như quy trình tích hợp liên tục (CI).

Trọng tâm của tuần là **hoàn thiện Connector Management, triển khai Node Type Management, chuẩn hóa Coding Standards và cải tiến CI Pipeline cho cả Frontend và Backend**.

Các mục tiêu cụ thể:

1. Hoàn thiện chức năng quản lý Connector, cho phép Admin kiểm soát chính sách tạo credential mới mà không ảnh hưởng đến credential hiện có.
2. Xây dựng chức năng quản lý Node Type, cho phép Admin kiểm soát khả năng hiển thị node trên Designer và khả năng thực thi tại Runtime.
3. Bảo đảm các thay đổi chính sách không làm mất tính tương thích ngược của những workflow đã được tạo trước đó.
4. Chuẩn hóa Coding Standards cho Backend, Frontend và quy trình phát triển tính năng.
5. Cải tiến CI Pipeline, bổ sung lint, type-check, unit test, integration test, build và security scanning.
6. Kiểm tra migration, kiểm thử và bảo đảm các thay đổi không ảnh hưởng đến dữ liệu hiện có.

---

## 3. Nội dung công việc đã thực hiện

### 3.1. Hoàn thiện chức năng quản lý Connector (Connector Management)

Nhóm hoàn thiện chức năng quản lý Connector dành cho Admin, cho phép theo dõi danh mục kết nối và kiểm soát việc cấp mới credential cho từng connector.

**Backend:**

- Bổ sung bảng `connector_policies` để lưu trữ chính sách riêng cho từng connector.
- Tách biệt metadata của connector với chính sách quản trị nhằm tránh việc đồng bộ catalog ghi đè các thiết lập của Admin.
- Xây dựng `ChangeConnectorPolicyCommand` và `ChangeConnectorPolicyHandler` để xử lý thay đổi chính sách.
- Bổ sung cơ chế optimistic concurrency thông qua `expectedRevision`.
- Khi revision không khớp, Backend trả về lỗi `STALE_REVISION` để tránh ghi đè thay đổi của Admin khác.
- Ghi nhận audit event `CONNECTOR_POLICY_CHANGED` khi chính sách được cập nhật thành công.
- Không tăng revision và không tạo audit event đối với thao tác không làm thay đổi dữ liệu (no-op).

**Kiểm soát việc tạo Credential:**

- Bổ sung cơ chế kiểm tra `allowNewCredentials` trước khi tạo API Key credential.
- Kiểm soát cả luồng tạo Google OAuth authorization URL và OAuth2 authorization URL.
- Kiểm tra lại chính sách tại OAuth callback để xử lý trường hợp Admin thay đổi chính sách trong khi người dùng đang thực hiện OAuth.
- Bổ sung transaction locking và kiểm tra lại policy nhằm hạn chế race condition.
- Khi connector bị tạm ngưng cấp credential mới, các credential đã tồn tại vẫn có thể được sử dụng, giải mã và refresh bình thường.
- Việc thay đổi chính sách không làm gián đoạn các workflow đang sử dụng credential cũ.

**Frontend:**

- Bổ sung trang `/admin/connectors`.
- Xây dựng bảng danh sách connector với các thông tin:
  - Tên và loại xác thực.
  - Trạng thái hoạt động.
  - Chính sách cho phép tạo credential mới.
  - Số lượng credential đang tồn tại.
  - Số lượng workflow đang sử dụng.
- Hỗ trợ tìm kiếm, lọc theo loại xác thực và trạng thái.
- Xây dựng `ConnectorPolicyDialog` để Admin điều chỉnh chính sách và bắt buộc nhập lý do thay đổi.
- Bổ sung `ConnectorDisabledBanner` trong Designer để thông báo khi connector không cho phép tạo kết nối mới.

### 3.2. Xây dựng chức năng quản lý Node Type (Node Type Management)

Nhóm triển khai chức năng quản lý các loại node trong hệ thống, cho phép Admin kiểm soát danh mục node và khả năng thực thi của từng loại node.

Một điểm quan trọng trong thiết kế là **tách biệt hai chính sách: hiển thị trên Designer và cho phép thực thi tại Runtime**.

**Backend và Database:**

- Bổ sung bảng `node_type_policies` để lưu trữ chính sách quản trị cho từng loại node.
- Tạo migration `20261122000000_node_type_policy`.
- Tách biệt dữ liệu định nghĩa node trong `node_type_definitions` với chính sách quản trị trong `node_type_policies`.
- Bổ sung `ChangeNodeTypeStatusCommand` để xử lý thay đổi chính sách.
- Sử dụng advisory lock, optimistic revision và transaction để bảo đảm tính nhất quán khi nhiều Admin cập nhật đồng thời.
- Ghi nhận audit event `NODE_TYPE_STATUS_CHANGED` trong cùng transaction với thao tác cập nhật chính sách.

**Hai cấp độ kiểm soát Node Type:**

- `isCatalogVisible`: Kiểm soát node có xuất hiện trong danh sách node trên Designer hay không.
- `isExecutionAllowed`: Kiểm soát node có được phép thực thi tại Runtime hay không.

Các quy tắc được triển khai:

- Node bị ẩn khỏi catalog sẽ không xuất hiện trong Sidebar của Designer.
- Node bị chặn thực thi sẽ không được gọi executor.
- Khi một node bị vô hiệu hóa tại Runtime, hệ thống ghi nhận trạng thái `FAILED` với mã lỗi `NODE_TYPE_DISABLED`.
- Việc ẩn node khỏi catalog không làm mất khả năng tải và chỉnh sửa các workflow cũ đang sử dụng node đó.
- Việc đồng bộ catalog không được phép ghi đè chính sách do Admin thiết lập.

**Admin API:**

Bổ sung các API phục vụ quản lý Node Type:

- `GET /api/admin/node-types`: Lấy danh sách node type, hỗ trợ tìm kiếm, lọc và phân trang.
- `GET /api/admin/node-types/:key`: Xem chi tiết node type.
- `PATCH /api/admin/node-types/:key/status`: Cập nhật chính sách hiển thị và thực thi.

Thông tin thống kê bao gồm số lượng workflow đã publish và workflow ở trạng thái draft đang sử dụng từng node type.

**Frontend:**

- Bổ sung trang `/admin/node-types`.
- Xây dựng `NodeTypesPage`, `NodeTypeTable`, `NodeTypeDetailCard` và `NodeTypeStatusDialog`.
- Hỗ trợ tìm kiếm, lọc theo category, phân trang và xem chi tiết node.
- Cho phép Admin điều chỉnh riêng hai chính sách hiển thị và thực thi.
- Bắt buộc nhập lý do khi thay đổi chính sách.
- Xử lý trường hợp `STALE_REVISION` bằng cách tải lại chính sách mới nhất và cho phép Admin thực hiện lại thao tác.
- Bổ sung component `NodeIcon` dùng chung để chuẩn hóa cách hiển thị biểu tượng node trên giao diện.

### 3.3. Chuẩn hóa Coding Standards và quy trình phát triển

Nhóm thực hiện chuẩn hóa tài liệu Coding Standards nhằm thống nhất cách tổ chức và triển khai mã nguồn giữa các thành viên.

Các tài liệu được cập nhật:

- `docs/backend/coding.standard.md`
- `docs/frontend/coding.standard.md`
- `docs/workflow-coding.md`
- `AGENTS.md`
- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `.agents/skills/workflow-automation-backend-guidelines/SKILL.md`
- `.agents/skills/workflow-automation-frontend-guidelines/SKILL.md`

Các nội dung chính:

**Backend Coding Standards:**

- Chuẩn hóa cấu trúc module và phân chia trách nhiệm giữa các layer.
- Thống nhất cách xử lý DTO, validation, exception và dependency injection.
- Quy định về TypeScript, naming convention và tổ chức imports.
- Chuẩn hóa cách triển khai repository, application service và domain logic.
- Bổ sung nguyên tắc kiểm thử unit test và integration test.
- Nhấn mạnh việc kiểm soát authorization, validation và bảo mật dữ liệu.

**Frontend Coding Standards:**

- Chuẩn hóa cấu trúc feature-based architecture.
- Phân biệt server state và client state.
- Thống nhất cách sử dụng React Query, hooks, services và components.
- Chuẩn hóa cách xử lý loading, empty, error và success states.
- Bổ sung nguyên tắc accessibility và kiểm thử giao diện.
- Hạn chế sử dụng `any`, unsafe type casting và các thao tác gây mất an toàn kiểu dữ liệu.

**Quy trình phát triển tính năng:**

Nhóm thống nhất áp dụng Specification-Driven Development (SDD) kết hợp Test-Driven Development (TDD).

Quy trình thực hiện:

1. **Understand:** Tìm hiểu kiến trúc, mã nguồn hiện tại và các ràng buộc liên quan.
2. **Specify:** Xây dựng hoặc cập nhật `spec.md`, `design.md`, `plan.md` và `task.md`.
3. **Review:** Kiểm tra yêu cầu, thiết kế, acceptance criteria và các trường hợp ngoại lệ.
4. **Implement:** Triển khai theo chu trình Red → Green → Refactor.
5. **Verify:** Chạy test, lint, type-check, build và cập nhật tài liệu.

Mục tiêu là giảm sự không nhất quán trong quá trình phát triển và bảo đảm mã nguồn luôn đồng bộ với đặc tả.

### 3.4. Cải tiến CI Pipeline

Nhóm cải tiến GitHub Actions workflow trong `.github/workflows/ci-pipeline.yml` nhằm nâng cao chất lượng kiểm tra tự động trước khi tích hợp mã nguồn vào nhánh `master`.

Pipeline được tổ chức thành các nhóm công việc chính:

**1. Lint và Type-check**

- Sử dụng GitHub Actions Matrix Strategy để kiểm tra Frontend và Backend song song.
- Frontend chạy ESLint và TypeScript build check.
- Backend chạy ESLint và TypeScript type-check.
- Bổ sung script `lint:ci` để kiểm tra mã nguồn mà không tự động chỉnh sửa file bằng `--fix`.
- Bổ sung Prisma Generate trước khi thực hiện kiểm tra kiểu dữ liệu Backend.

**2. Backend Testing**

- Khởi tạo PostgreSQL 17 và Redis dưới dạng GitHub Actions Services.
- Kiểm tra Prisma Schema.
- Thực hiện database migration.
- Generate Prisma Client.
- Chạy unit test kèm coverage.
- Chạy integration test.
- Upload báo cáo coverage dưới dạng GitHub Actions Artifact.

**3. Frontend Testing**

- Cài đặt và bổ sung `@vitest/coverage-v8`.
- Chạy unit test với coverage.
- Thực hiện Frontend build.
- Upload báo cáo coverage dưới dạng artifact.

**4. Security Scanning**

Bổ sung hai công cụ kiểm tra bảo mật:

- **Gitleaks:** Quét lịch sử repository để phát hiện secret hoặc credential bị đưa vào mã nguồn.
- **Trivy:** Quét dependency và các lỗ hổng bảo mật có mức độ HIGH, CRITICAL.

Trong giai đoạn đầu, Trivy được cấu hình `exit-code: "0"` để ghi nhận kết quả quét mà chưa chặn pipeline. Đây là cấu hình chuyển tiếp, cần được siết chặt sau khi xử lý các cảnh báo hiện có.

**5. Pipeline Optimization**

- Bổ sung `concurrency` để hủy các CI run cũ khi có commit mới trên cùng ref.
- Giới hạn quyền mặc định của workflow bằng `permissions: contents: read`.
- Sử dụng npm cache để giảm thời gian cài đặt dependency.
- Tách các job thành những nhóm độc lập để tận dụng khả năng chạy song song.

### 3.5. Migration và kiểm tra Database

Trong quá trình triển khai Connector Management và Node Type Management, nhóm phát hiện database local chưa có hai bảng chính sách mới dù Backend đã được cập nhật.

Các bước xử lý:

- Kiểm tra trạng thái migration bằng Prisma.
- Xác định hai migration chưa được áp dụng:
  - `20261116000000_admin_connector_policy`
  - `20261122000000_node_type_policy`
- Sử dụng `prisma migrate deploy` để áp dụng các migration còn thiếu.
- Kiểm tra lại trạng thái database và xác nhận schema đã đồng bộ.
- Chạy các truy vấn thực tế thông qua `PrismaAdminRead` để xác minh các API đọc Connector và Node Type hoạt động bình thường.
- Kiểm tra lại các endpoint liên quan sau khi migration.

Kết quả xác minh:

- Các truy vấn quản trị Connector và Node Type hoạt động bình thường sau khi áp dụng migration.
- Các bảng và dữ liệu User, Workflow, Workflow Version, Credential và Execution hiện có được giữ nguyên.
- Database local đã ở trạng thái up-to-date.

---

## 4. Kết quả kiểm thử và chất lượng

Theo kết quả kiểm thử được ghi nhận trong các checklist triển khai và tài liệu nghiệm thu:

| Hạng mục | Kết quả |
| --- | --- |
| Connector Management – Backend | Hoàn thành các unit test cho policy, credential gate, OAuth và catalog synchronization |
| Connector Management – Frontend | Hoàn thành test cho hooks, policy dialog và connector disabled banner |
| Node Type Management – Backend Unit Tests | 45 test suites, 574 tests passed |
| Node Type Management – Backend Integration Tests | 24 tests passed ở lượt kiểm thử trước; 6 tests trong integration suite cuối cùng dành cho G5 |
| Node Type Management – Frontend | 53 test suites, 171 tests passed |
| Backend ESLint | Thành công |
| Frontend ESLint | Thành công |
| Backend production TypeScript check | Thành công |
| Frontend TypeScript check | Thành công |
| Backend build | Webpack compiled successfully |
| Frontend build | Thành công, còn cảnh báo bundle size vượt 500 kB |
| Prisma Generate và Validate | Thành công |
| Database Migration | Hai migration Connector và Node Type được áp dụng thành công trên database local |
| Git diff check | Thành công |

Các tình huống quan trọng được kiểm tra:

- Connector bị tắt chính sách tạo mới credential không thể tạo API Key hoặc khởi tạo OAuth authorization mới.
- Credential cũ vẫn có thể được sử dụng và refresh bình thường.
- OAuth callback kiểm tra lại chính sách để tránh race condition.
- Hai Admin cập nhật cùng một chính sách không làm mất thay đổi của nhau.
- Các thao tác no-op không tạo audit event.
- Node bị ẩn không xuất hiện trong Designer nhưng workflow cũ vẫn có thể tải và chỉnh sửa.
- Node bị chặn thực thi không gọi executor và ghi nhận mã lỗi `NODE_TYPE_DISABLED`.
- Catalog synchronization không ghi đè các chính sách quản trị.
- Admin API kiểm tra quyền truy cập, dữ liệu đầu vào và revision.
- Kiểm tra transaction, audit rollback và các trường hợp cập nhật đồng thời trên PostgreSQL thật.

**Lưu ý về kiểm thử:**

- Backend full TypeScript check vẫn ghi nhận 7 lỗi kiểu dữ liệu trong các test fixture cũ, không thuộc production source của Node Type Management. Production build type-check đã thành công.
- Frontend build vẫn có cảnh báo bundle JavaScript vượt ngưỡng 500 kB.
- CI Pipeline đã được cấu hình và tích hợp vào repository; không xem việc cấu hình workflow là bằng chứng toàn bộ CI jobs đã chạy thành công.
- Security scanning hiện chưa chặn pipeline khi phát hiện lỗ hổng do Trivy đang sử dụng `exit-code: "0"`.

---

## 5. Kết quả đạt được

1. Hoàn thiện Connector Management, cho phép Admin theo dõi connector và kiểm soát chính sách cấp mới credential.
2. Bảo đảm việc tạm ngưng tạo credential mới không ảnh hưởng đến credential hiện có và các workflow đang sử dụng chúng.
3. Hoàn thành Node Type Management với hai cấp độ kiểm soát độc lập: hiển thị trên Designer và thực thi tại Runtime.
4. Bảo đảm tính tương thích ngược cho workflow cũ khi node bị ẩn khỏi catalog.
5. Bổ sung cơ chế revision, transaction locking và audit event để tăng tính nhất quán khi thay đổi chính sách quản trị.
6. Chuẩn hóa Coding Standards cho Backend, Frontend và quy trình phát triển tính năng theo SDD/TDD.
7. Cải tiến CI Pipeline với các bước lint, type-check, unit test, integration test, build, coverage và security scanning.
8. Hoàn thành hai migration mới và xác minh dữ liệu hiện có không bị ảnh hưởng.

---

## 6. Khó khăn và hướng giải quyết

- **Đồng bộ chính sách với Connector Catalog:** Việc đồng bộ catalog có thể ghi đè dữ liệu quản trị nếu lưu chính sách trực tiếp trong bảng metadata. Nhóm tách riêng `connector_policies` để bảo đảm chính sách được duy trì độc lập.
- **Race condition trong OAuth:** Chính sách có thể thay đổi sau khi người dùng đã nhận authorization URL nhưng trước khi OAuth callback hoàn tất. Nhóm bổ sung transaction locking và kiểm tra lại policy tại callback.
- **Bảo toàn workflow cũ khi thay đổi Node Type:** Nếu chỉ loại bỏ node khỏi catalog, các workflow cũ có thể không tải hoặc chỉnh sửa được. Nhóm tách biệt catalog visibility với runtime execution policy để tránh ảnh hưởng không cần thiết.
- **Đảm bảo tính nhất quán khi nhiều Admin thao tác:** Các thay đổi đồng thời có thể dẫn đến ghi đè dữ liệu. Nhóm sử dụng optimistic concurrency thông qua revision, advisory lock và transaction.
- **Chuẩn hóa chất lượng mã nguồn:** Các thành viên có cách tổ chức code và kiểm thử khác nhau. Nhóm xây dựng Coding Standards và quy trình SDD/TDD thống nhất.
- **Tăng độ bao phủ của CI:** Pipeline cũ chưa kiểm tra đầy đủ integration test, coverage và bảo mật. Nhóm tách job, bổ sung PostgreSQL/Redis services và các công cụ kiểm tra tương ứng.
- **Database local chưa đồng bộ migration:** Các bảng chính sách mới chưa tồn tại trong database đang chạy. Nhóm kiểm tra trạng thái migration, áp dụng các migration còn thiếu và xác minh lại API bằng truy vấn thực tế.

---

## 7. Phạm vi còn lại và kế hoạch tuần tiếp theo

Sau Tuần 11, nhóm đã hoàn thành thêm hai thành phần quan trọng của Admin P1 là Connector Management (G4) và Node Type Management (G5).

Các phần còn lại cần tiếp tục triển khai:

1. **Execution Monitoring (G6):** Xây dựng giao diện và API giám sát execution trên toàn hệ thống, hỗ trợ lọc theo owner, workflow, execution ID, trạng thái và thời gian. Chỉ hiển thị metadata an toàn, không làm lộ input/output, secret hoặc stack trace.
2. **Admin Audit Log Viewer (G7):** Xây dựng chức năng tra cứu lịch sử thao tác quản trị, hỗ trợ lọc theo actor, action, target và thời gian.
3. **Hoàn thiện nghiệm thu Admin MVP:** Kiểm tra tích hợp giữa User Management, Dashboard, Connector Management, Node Type Management, Execution Monitoring và Audit Log Viewer.

Mục tiêu của tuần tiếp theo là tiếp tục hoàn thiện các thành phần Admin P1 còn lại, hướng đến hoàn thành phạm vi quản trị hệ thống của Admin MVP.