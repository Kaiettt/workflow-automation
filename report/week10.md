# BÁO CÁO TIẾN ĐỘ TUẦN 10

## 1. Thông tin chung

- **Tên đề tài:** CrabFlowPilot – Nền tảng thiết kế và tự động hóa quy trình (Workflow Automation)
- **Học kỳ:** Học kỳ 1, năm học 2026–2027
- **Tuần báo cáo:** Tuần 10
- **Thời gian báo cáo:** 09/11/2026 – 15/11/2026
- **Sinh viên thực hiện:**
  - Nguyễn Anh Kiệt – MSSV: 23110246
  - Nguyễn Văn Hiếu – MSSV: 23110214
- **Giảng viên hướng dẫn:** ThS. Nguyễn Hữu Trung
- **Mã nguồn dự án:** `workflow-automation`
- **Nhánh làm việc:** `master`
- **Ngày chốt số liệu:** 14/11/2026

---

## 2. Mục tiêu của tuần

Trong Tuần 10, nhóm tập trung xây dựng nền tảng quản trị hệ thống (Admin Management) để hỗ trợ vận hành FlowPilot khi số lượng tài khoản và workflow tăng lên. Trọng tâm của giai đoạn này là **chuẩn hóa mô hình phân quyền còn hai vai trò CLIENT và ADMIN, xây dựng chức năng quản lý tài khoản, bảo đảm hiệu lực quyền ở Backend và triển khai Dashboard tổng quan**.

Một yêu cầu quan trọng của thiết kế là Admin có thể quản lý tài khoản và theo dõi metadata vận hành toàn nền tảng nhưng **không được mặc nhiên vượt qua quyền sở hữu dữ liệu (ownership)** để đọc nội dung workflow, input/output, snapshot version hoặc credential của Client.

Các mục tiêu cụ thể:

1. Chuẩn hóa role và bảo vệ các route/API dành riêng cho Admin.
2. Xây dựng danh sách, chi tiết tài khoản và chức năng khóa/mở khóa, thay đổi role.
3. Bảo đảm việc thay đổi trạng thái tài khoản có hiệu lực với access token, refresh token, execution queue và webhook.
4. Xây dựng dashboard thống kê tài khoản, workflow, execution, tỷ lệ thành công, xu hướng và nhóm lỗi.
5. Ghi nhận audit event để truy vết các thay đổi quản trị.
6. Chạy kiểm thử Backend, Frontend, migration và build để nghiệm thu phạm vi P0.

---

## 3. Nội dung công việc đã thực hiện

### 3.1. Chuẩn hóa mô hình role và bảo vệ khu vực Admin

Nhóm chuyển mô hình role hiện có về hai vai trò thống nhất:

- `CLIENT`: người dùng sử dụng nền tảng để tạo và vận hành workflow của chính mình.
- `ADMIN`: người quản trị nền tảng.

Các thay đổi chính:

- Cập nhật Prisma enum, domain/auth DTO, frontend types, seed và test fixtures để sử dụng hai role mới.
- Migration chuyển `DEVELOPER` và `BUSINESS_USER` hiện có thành `CLIENT`, giữ nguyên tài khoản `ADMIN`.
- Public registration không còn cho phép người dùng tự chọn role; tài khoản đăng ký mới luôn được tạo với role `CLIENT`.
- Request đăng ký cố truyền role bị từ chối nhằm ngăn việc tự cấp quyền cao.
- Bổ sung quy trình bootstrap Admin đầu tiên thông qua lệnh quản trị nội bộ, không cung cấp public API để tự cấp Admin.
- Bổ sung `AdminLayout`, menu điều hướng và route guard cho khu vực `/admin/*`.
- Backend bảo vệ `/api/admin/*` bằng xác thực và role guard; quyền được xác định dựa trên trạng thái tài khoản hiện tại, không chỉ tin claim role cũ trong JWT.

Các tình huống truy cập được chuẩn hóa: request chưa xác thực nhận `401`, Client đã đăng nhập nhưng truy cập API Admin nhận `403`.

### 3.2. Xây dựng chức năng quản lý tài khoản

Nhóm triển khai các API/query và giao diện quản lý tài khoản trong `libs/admin` và `frontend/src/features/admin`.

**Danh sách tài khoản:**

- Hiển thị ID, tên, email, role, trạng thái active/inactive và thời điểm tạo.
- Hỗ trợ tìm kiếm theo tên/email, lọc theo role và trạng thái.
- Phân trang và sắp xếp phía Server để tránh tải toàn bộ dữ liệu tài khoản về Frontend.
- Response sử dụng projection whitelist, không trả password hash, token, OTP hoặc credential.

**Chi tiết tài khoản:**

- Hiển thị metadata tài khoản và thời điểm cập nhật.
- Tổng hợp số lượng workflow, credential và execution liên quan.
- Danh sách workflow chỉ cung cấp metadata cần thiết như ID, tên, trạng thái publish/archive, active và thời điểm cập nhật.
- Execution được thống kê theo workflow owner, bao gồm cả các lượt chạy tự động không có `triggeredById`.

**Thao tác quản trị:**

- Hỗ trợ khóa/mở khóa tài khoản và chuyển đổi role giữa `CLIENT` và `ADMIN`.
- Mutation yêu cầu lý do thay đổi (`reason`) và revision mà Admin đã đọc (`expectedRevision`).
- Bổ sung kiểm tra không cho Admin tự khóa/tự đổi role, không khóa hoặc hạ quyền Admin active cuối cùng và không cấp Admin cho tài khoản inactive.
- Khi revision đã cũ, Backend trả `409 STALE_REVISION`; Frontend tải lại dữ liệu để Admin xem trước khi thực hiện thao tác tiếp theo.
- Thao tác không làm thay đổi ownership của workflow và không xóa dữ liệu người dùng.

### 3.3. Bảo đảm hiệu lực phiên đăng nhập và quyền truy cập

Nhóm triển khai cơ chế session version để bảo đảm thay đổi quyền không chỉ dừng ở giao diện.

- Bổ sung `revision` và `session_version` vào user.
- Access token và refresh token mang session version; Backend đối chiếu với trạng thái hiện tại trong database.
- Khi khóa tài khoản hoặc thay đổi role, session version được tăng để vô hiệu hóa token đã phát hành.
- Mở khóa tài khoản không làm token cũ sống lại; người dùng cần đăng nhập lại để tạo phiên mới.
- Ghi nhận session revocation và audit trong cùng transaction với thay đổi tài khoản.
- Bổ sung cơ chế outbox/retry để xử lý việc thu hồi refresh token sau commit; database vẫn là nguồn quyết định để chặn phiên cũ khi Redis gặp sự cố.
- Frontend hủy request và xóa cache liên quan khi logout hoặc khi phiên không còn hợp lệ; xử lý trường hợp refresh response trả về muộn để tránh khôi phục nhầm account cũ.

### 3.4. Kiểm soát tác động của việc khóa tài khoản lên Execution và Webhook

Đây là phần quan trọng để bảo đảm thao tác quản trị không chỉ ảnh hưởng đến đăng nhập mà còn kiểm soát được các workflow đang chạy tự động.

**Execution queue và worker:**

- Bổ sung kiểm tra trạng thái owner khi enqueue và khi worker claim execution.
- Việc khóa owner và chuyển execution từ `QUEUED` sang `RUNNING` được đồng bộ bằng transaction/lock để tránh race condition.
- Nếu owner đã inactive khi worker claim, execution được chuyển sang `CANCELLED` với lý do `OWNER_SUSPENDED`.
- Worker không gọi executor hoặc dịch vụ bên ngoài đối với execution bị hủy do owner inactive.
- Execution đã chuyển sang `RUNNING` trước thời điểm khóa được phép hoàn tất theo policy hiện tại.
- Failure/stale-job hook không được ghi đè trạng thái `CANCELLED`.
- Mở khóa không tự động replay execution đã bị hủy hoặc sự kiện đã bị bỏ qua.

**Webhook và trigger:**

- Webhook của owner inactive vẫn được acknowledge theo contract của provider.
- Hệ thống không enqueue execution mới và không lưu payload thành test event cho tài khoản đã bị khóa.
- Sau khi mở khóa, hệ thống chỉ tiếp nhận sự kiện mới, không phát lại các payload đã bỏ qua.

**Private SSE stream:**

- Kiểm tra phiên khi mở stream, trước khi phát event và qua heartbeat định kỳ.
- Khi phiên bị thu hồi, stream được đóng và subscription/timer được cleanup.
- Giới hạn nghiệm thu yêu cầu stream riêng tư phải dừng trong tối đa 30 giây sau khi quyền bị thu hồi.

### 3.5. Xây dựng Dashboard quản trị

Nhóm triển khai API aggregate và giao diện Dashboard để Admin theo dõi tình hình hoạt động của hệ thống.

Các nhóm số liệu:

- **Tài khoản:** tổng tài khoản, Client active/inactive và Admin active.
- **Workflow:** tổng số workflow và số lượng theo trạng thái `DRAFT`, `PUBLISHED`, `ARCHIVED`; số workflow đang active được thống kê riêng.
- **Execution:** số lượt theo `QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, `CANCELLED`.
- **Success rate:** tính theo công thức `SUCCESS / (SUCCESS + FAILED) × 100`; không tính execution chưa kết thúc hoặc bị hủy.
- **Execution trend:** số lượng execution theo ngày và trạng thái.
- **Error groups:** nhóm lỗi dựa trên mã lỗi chuẩn hóa, không sử dụng raw error message.

Quy tắc thời gian và hiển thị:

- Mặc định thống kê 7 ngày gần nhất; hỗ trợ 24 giờ, 7 ngày, 30 ngày và khoảng tùy chỉnh tối đa 90 ngày.
- Execution được lọc theo `queuedAt`, sử dụng khoảng `[from, to)` và thời gian UTC.
- Biểu đồ nhóm theo ngày dựa trên timezone gửi kèm truy vấn.
- Account/workflow là snapshot hiện tại, được phân biệt với số liệu execution trong khoảng thời gian chọn.
- Khi không có dữ liệu để tính success rate, giao diện hiển thị trạng thái “Chưa có dữ liệu” thay vì 0%.
- Frontend polling mỗi 30 giây khi trang đang hiển thị; có trạng thái loading, empty, error và retry.

### 3.6. Audit log và tính nhất quán dữ liệu

- Bổ sung bảng `admin_audit_events` để lưu actor, action, target, reason, before/after và thời điểm phát sinh.
- Thay đổi tài khoản và audit event được ghi trong cùng transaction; nếu ghi audit thất bại, mutation phải rollback.
- Bootstrap Admin đầu tiên tạo audit event với actor `SYSTEM`.
- Các thao tác no-op không tạo audit event giả.
- Bổ sung `error_code` và `cancellation_reason` cho execution/node log để hỗ trợ dashboard mà không phải trả raw error message.
- Mã lỗi không nhận diện được được quy về `UNCLASSIFIED_ERROR` khi tạo projection thống kê an toàn.

### 3.7. Migration và kiểm tra triển khai

- Tạo migration `20261114000000_admin_p0`.
- Chạy `prisma migrate deploy` trên database local `flowpilot` tại `localhost:5433`.
- Xác minh dữ liệu role cũ được chuyển đổi mà không xóa user hoặc các dữ liệu workflow, version, credential và execution liên quan.
- Cập nhật seed theo hướng chỉ tạo tài khoản còn thiếu, không ghi đè role, trạng thái active, password hoặc session version của tài khoản đã tồn tại.
- Bổ sung Admin local phục vụ phát triển và kiểm thử; quy trình này không thay thế bootstrap bảo mật dành cho production.

---

## 4. Kết quả kiểm thử và chất lượng

Theo tài liệu nghiệm thu Admin P0 cập nhật ngày 14/11/2026:

| Hạng mục | Kết quả |
| --- | --- |
| Backend Jest | 37 test suites, 538 tests passed |
| Backend Integration Tests | 18 tests passed với PostgreSQL/Redis và HTTP |
| Backend ESLint | 303 files; 0 errors, 0 warnings |
| Backend Nest build | Thành công |
| Backend production TypeScript check | Thành công |
| Frontend Vitest | 44 test files, 150 tests passed |
| Frontend build | Lint, TypeScript và Vite build thành công |
| Prisma migration | Áp dụng thành công `20261114000000_admin_p0` trên database local |

Các tình huống quan trọng được kiểm tra:

- Không đăng nhập nhận `401`; Client gọi API Admin nhận `403`.
- Public registration không thể tự cấp role Admin.
- Migration chuyển role cũ và giữ nguyên ownership/dữ liệu liên quan.
- Bootstrap Admin có audit và không thể thực hiện lại khi đã tồn tại Admin active.
- Hai Admin thao tác đồng thời không thể làm mất Admin active cuối cùng.
- Mutation dùng revision cũ nhận `409`; audit lỗi khiến transaction rollback.
- Token cũ không được sử dụng lại sau khi khóa/mở khóa hoặc đổi role.
- Redis cleanup lỗi vẫn không làm token cũ hợp lệ trở lại.
- Execution queued của owner inactive bị hủy trước khi executor chạy; execution đang chạy được hoàn tất.
- Webhook của owner inactive được acknowledge nhưng không enqueue hoặc lưu payload.
- Dashboard xử lý đúng success rate, trường hợp không có dữ liệu, timezone và ranh giới thời gian.
- Response Admin không chứa workflow definition, input/output, secret hoặc raw error message của Client.
- Seed chạy lại không ghi đè trạng thái tài khoản đã tồn tại.

**Lưu ý:** Frontend build vẫn có cảnh báo kích thước JavaScript bundle vượt 500 kB; build không thất bại. Root backend TypeScript check trên toàn bộ test fixtures còn một số lỗi kiểu ở các fixture cũ, nhưng production TypeScript check, Jest và build đã nêu ở trên đều thành công. Chưa thực hiện kiểm tra tương tác bằng trình duyệt hoặc đo tải production.

---

## 5. Kết quả đạt được

1. Hoàn thành phạm vi Admin P0 gồm nền tảng role, bảo vệ route/API, quản lý tài khoản và Dashboard.
2. Chuẩn hóa hai role `CLIENT` và `ADMIN`; loại bỏ khả năng tự chọn role trong public registration.
3. Bảo đảm thay đổi trạng thái tài khoản có hiệu lực ở cả authentication, execution queue, worker, webhook và private SSE stream.
4. Bổ sung audit trail cho các thay đổi quản trị và cơ chế revision để xử lý cập nhật đồng thời.
5. Dashboard cung cấp số liệu vận hành theo định nghĩa thống nhất và không làm lộ dữ liệu nhạy cảm của Client.
6. Hoàn thành migration và các kiểm thử Backend/Frontend cho phạm vi P0.

---

## 6. Khó khăn và hướng giải quyết

- **Đảm bảo quyền có hiệu lực ngay sau khi thay đổi:** JWT đã phát hành có thể còn hiệu lực nếu chỉ thay đổi role trong database. Nhóm bổ sung session version và kiểm tra trạng thái hiện tại để vô hiệu hóa phiên cũ.
- **Race condition giữa khóa tài khoản và worker:** nếu chỉ kiểm tra `isActive` trước khi enqueue/claim, trạng thái tài khoản có thể thay đổi ngay sau lần kiểm tra. Nhóm đồng bộ thao tác bằng transaction lock trên owner để bảo đảm thứ tự commit nhất quán.
- **Bảo toàn dữ liệu Client:** Admin cần theo dõi hoạt động toàn hệ thống nhưng không được vượt ownership. Nhóm sử dụng projection whitelist và API riêng thay vì tái sử dụng response chứa nội dung workflow.
- **Độ tin cậy của audit:** audit phải phản ánh đúng mutation đã commit. Nhóm ghi audit cùng transaction để tránh trường hợp thay đổi thành công nhưng không có lịch sử.
- **Tính chính xác của Dashboard:** dữ liệu có nhiều trạng thái và timezone. Nhóm thống nhất công thức, khoảng thời gian `[from, to)`, timezone grouping và cách xử lý mẫu số bằng 0.

---

## 7. Phạm vi còn lại và kế hoạch tuần tiếp theo

Tại thời điểm chốt báo cáo, **P0 đã hoàn thành và được kiểm tra; P1 của Admin MVP chưa hoàn thành**. Các phần còn lại gồm:

1. **Connector Management:** xây dựng chính sách cho phép/chặn tạo credential mới theo connector, đồng thời bảo đảm credential hiện có vẫn có thể được sử dụng và gia hạn.
2. **Execution Monitoring dành cho Admin:** xây dựng danh sách/chi tiết execution ở mức metadata, bộ lọc và thông tin node an toàn; không hiển thị input/output hoặc nội dung workflow của Client.
3. **Admin Audit Viewer:** xây dựng API và giao diện tra cứu audit event, bao gồm các thay đổi tài khoản và chính sách connector.
4. Hoàn thiện kiểm thử nghiệm thu P1, rehearsal migration/seed/bootstrap và tài liệu triển khai/vận hành.
5. Tiếp tục theo dõi cảnh báo kích thước bundle Frontend và đánh giá tối ưu nếu cần.

