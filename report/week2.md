# BÁO CÁO TIẾN ĐỘ TUẦN 02

## 1. Thông tin chung

- **Tên đề tài:** CrabFlowPilot – Nền tảng thiết kế và tự động hóa quy trình (Workflow Automation)
- **Loại đề tài:** Điền theo mục đã đăng ký trên cổng projects-fit.hcmute.edu.vn
- **Học kỳ:** Học kỳ 1, năm học 2026–2027
- **Tuần báo cáo:** Tuần 02
- **Thời gian báo cáo:** 14/09/2026 – 20/09/2026
- **Sinh viên thực hiện:** Nguyễn Anh Kiệt - MSSV: 23110246, Nguyễn Văn Hiếu - MSSV: 23110214
- **Giảng viên hướng dẫn:** Nguyễn Hữu Trung
- **Mã nguồn dự án:** `workflow-automation`
- **Ngày chốt số liệu:** 20/09/2026

> **Lưu ý:** Cần điền thông tin cá nhân và điều chỉnh số tuần theo lịch chính thức trên cổng trước khi đăng.

---

## 2. Mục tiêu của tuần

Mục tiêu chính của tuần là hoàn thiện luồng đưa workflow từ bản nháp sang phiên bản có thể thực thi, đồng thời xây dựng nền tảng xác thực và phân quyền người dùng cho hệ thống. Các mục tiêu cụ thể gồm:

- Xây dựng chức năng validate và publish workflow, tạo phiên bản bất biến.
- Bổ sung giao diện Publish trong Workflow Designer và hiển thị lỗi validate.
- Xây dựng phân hệ Authentication gồm đăng ký, xác minh OTP, đăng nhập, làm mới phiên đăng nhập và quên mật khẩu.
- Tích hợp RBAC, JWT, Redis và SMTP/MailHog cho luồng xác thực an toàn.
- Hoàn thiện giao diện trang chủ, modal xác thực và cơ chế giữ phiên đăng nhập trên frontend.
- Bổ sung kiểm thử tích hợp cho API publish workflow và cập nhật cấu hình CI.

---

## 3. Nội dung công việc đã thực hiện

### 3.1. Xây dựng mô hình phiên bản workflow

Đã bổ sung domain entity `WorkflowVersion`, repository tương ứng và mở rộng các entity hiện có để quản lý quá trình publish:

- `Workflow` lưu `currentVersionId` để xác định phiên bản đang được publish/thực thi.
- `WorkflowDraft` bổ sung `validationErrors` để lưu lỗi của lần validate gần nhất.
- `WorkflowVersion` lưu snapshot graph, số phiên bản tăng dần, thời điểm publish và người publish.

Thiết kế này giữ draft theo quan hệ 1:1 với workflow, trong khi các version đã publish là bất biến. Nhờ đó, các lần thực thi về sau có thể gắn với một định nghĩa workflow xác định.

### 3.2. Hiện thực validate và publish workflow ở backend

Đã xây dựng `PublishWorkflowCommand` và handler theo CQRS. Khi nhận yêu cầu publish, hệ thống kiểm tra các điều kiện cơ bản của graph:

- Có đúng một trigger.
- Có ít nhất một action.
- Không có node bị rời khỏi graph.

Nếu không đạt điều kiện, backend trả lỗi `400 Bad Request` và lưu thông tin lỗi vào draft. Khi người dùng lưu lại draft, các lỗi validate cũ được xóa để có thể kiểm tra lại graph mới.

Nếu hợp lệ, hệ thống tạo snapshot bất biến trong `workflow_versions`, tự tăng số version và cập nhật phiên bản hiện hành của workflow.

### 3.3. Công bố API publish và kiểm thử tích hợp

Đã bổ sung API:

```http
POST /workflows/:id/versions
```

API ánh xạ yêu cầu HTTP vào `PublishWorkflowCommand`, trả trạng thái thành công khi tạo version và trả lỗi validate khi graph không hợp lệ. Một kiểm thử e2e đã được thêm cho trường hợp publish draft không có trigger, đồng thời kiểm tra lỗi được lưu lại và có thể truy xuất qua draft API.

### 3.4. Tích hợp publish trên Workflow Designer

Frontend đã được cập nhật để hoàn thiện luồng publish trong Designer:

- Bổ sung `publishWorkflow` tại API layer và service layer.
- Thêm nút **Publish** vào `DesignerLayout`.
- `DesignerPage` gọi API publish, thông báo kết quả thành công hoặc lỗi.
- Lỗi validate từ backend được hiển thị trong giao diện để người dùng sửa workflow trước khi publish lại.

Chức năng hiện hoàn thành luồng cơ bản từ thao tác trên canvas đến việc tạo phiên bản workflow ở backend.

### 3.5. Xây dựng Authentication Module theo Clean Architecture và CQRS

Đã xây dựng module `auth` độc lập trong backend theo các lớp domain, application, infrastructure và presentation. Module triển khai các command/query cho các luồng:

- Gửi OTP đăng ký.
- Xác minh OTP.
- Đăng ký tài khoản.
- Đăng nhập.
- Làm mới access token.
- Lấy thông tin người dùng hiện tại.
- Gửi OTP quên mật khẩu và đặt lại mật khẩu.

Các API được cung cấp dưới `/api/v1/auth`, gồm `send-register-otp`, `verify-otp`, `register`, `login`, `refresh`, `me`, `forgot-password` và `reset-password`.

### 3.6. Bảo mật phiên đăng nhập, OTP và phân quyền

Đã áp dụng các cơ chế bảo mật chính:

- Mật khẩu được kiểm tra độ phức tạp và băm bằng bcrypt trước khi lưu.
- OTP gồm 6 chữ số được lưu trên Redis trong 5 phút, không lưu vào PostgreSQL; OTP bị xóa sau khi xác minh thành công.
- Trạng thái email đã xác minh được giữ tạm trên Redis trong 15 phút.
- Access token JWT có thời hạn 15 phút; refresh token có thời hạn 7 ngày, được lưu và xoay vòng trên Redis.
- JWT mang theo `sub`, email và role; guards và decorators hỗ trợ RBAC với các role `ADMIN`, `DEVELOPER`, `BUSINESS_USER`.
- Dịch vụ email được tách qua abstraction; hạ tầng hiện dùng Nodemailer và cấu hình SMTP từ biến môi trường. MailHog được thêm vào Docker Compose để kiểm thử email cục bộ.

### 3.7. Xây dựng giao diện xác thực và trang chủ

Đã phát triển trang chủ FlowPilot gồm thanh điều hướng, phần giới thiệu chức năng, danh sách template, canvas minh họa và footer. Trên thanh điều hướng, người dùng có thể mở modal xác thực mà không rời trang hiện tại.

Modal hỗ trợ các luồng đăng nhập, đăng ký và quên mật khẩu. Form đăng ký có kiểm tra mật khẩu xác nhận, hiển thị độ mạnh mật khẩu theo thời gian thực và cho phép chọn role `DEVELOPER` hoặc `BUSINESS_USER`. Sau khi đăng nhập, giao diện hiển thị thông tin người dùng và menu đăng xuất.

### 3.8. Chuẩn hóa HTTP client và duy trì phiên ở frontend

Đã tạo Axios client dùng chung cho frontend. Request interceptor tự gắn `Authorization: Bearer <accessToken>`; response interceptor xử lý lỗi `401` bằng cách gọi refresh token, cập nhật token mới và gửi lại request ban đầu. Nếu refresh thất bại, trạng thái đăng nhập được xóa an toàn.

Zustand store quản lý user, access token, refresh token và trạng thái xác thực. Cả API authentication và workflow đã được chuyển sang dùng HTTP client chung.

### 3.9. Cập nhật môi trường và tích hợp mã nguồn

Đã bổ sung biến môi trường cho JWT, Redis và SMTP; Docker Compose được cập nhật để hỗ trợ Redis và MailHog trong môi trường local. CI cũng được điều chỉnh để sinh Prisma Client trước khi chạy các bước cần thiết và sửa các lỗi ESLint của auth module.

Trong giai đoạn 18/09/2026–20/09/2026, dự án có 13 commit, trong đó đã merge Pull Request #6 cho Publish Workflow và Pull Request #7 cho Authentication.

### 3.10. Ứng dụng agent skills vào quy trình phát triển

Trong quá trình coding workflow, nhóm đã sử dụng bộ **agent skills của Matt Pocock** được tổ chức trong thư mục `.agents`. Một số skills tiêu biểu được sử dụng gồm `/grill-me`, `/to-spec`, `/tdd`, `/implement`, `/code-review` và `/diagnosing-bugs`.

Các skills này được áp dụng xuyên suốt quy trình phát triển: làm rõ yêu cầu trước khi triển khai, xây dựng đặc tả, thực hiện chức năng theo hướng kiểm thử, review mã nguồn và chẩn đoán lỗi phát sinh. Qua đó, việc phát triển các chức năng Publish Workflow và Authentication được tổ chức rõ ràng hơn, giảm thiếu sót khi triển khai và bám sát kiến trúc của dự án.

---

## 4. Kết quả đạt được

- Hoàn thành chức năng publish workflow với validate graph, lưu lỗi và tạo phiên bản bất biến.
- Hoàn thành API publish và kiểm thử e2e cho một trường hợp validate lỗi.
- Hoàn thành nền tảng Authentication/RBAC: đăng ký, OTP, đăng nhập, refresh token, lấy profile và đặt lại mật khẩu.
- Tích hợp Redis cho dữ liệu OTP/refresh token tạm thời và Nodemailer/MailHog cho gửi email.
- Hoàn thành modal xác thực, password strength meter, menu người dùng và logout trên frontend.
- Hoàn thành HTTP client dùng chung, tự gắn JWT và tự refresh token khi nhận `401`.
- Hoàn thiện giao diện trang chủ FlowPilot và cập nhật môi trường/CI phục vụ phát triển.
- Áp dụng các agent skills của Matt Pocock trong `.agents` để hỗ trợ coding workflow, kiểm thử, review và xử lý lỗi theo quy trình.

---

## 5. Bảng tiến độ theo nhóm yêu cầu

| Nhóm | Trạng thái | Nhận xét |
|--------|--------|--------|
| Workflow Designer UI | Hoàn thành một phần | Đã có thao tác canvas, autosave và Publish; cần hoàn thiện thông báo thân thiện, highlight node lỗi và kiểm thử UI |
| Designer Backend | Hoàn thành một phần | Có create/get/save draft và publish version; cần mở rộng validate cấu hình node và concurrency |
| Workflow Version Management | Hoàn thành MVP | Đã tạo version bất biến, tăng version number và cập nhật current version; chưa có compare/rollback UI |
| Authentication | Hoàn thành MVP | Có đăng ký, xác minh OTP, đăng nhập, refresh, `/me`, quên/đặt lại mật khẩu |
| Authorization/RBAC | Hoàn thành nền tảng | JWT, role guard và decorators đã có; cần áp dụng/kiểm thử quyền trên các nghiệp vụ cụ thể |
| Frontend Session | Hoàn thành MVP | Zustand và Axios interceptor đã duy trì/refresh phiên; cần kiểm thử các tình huống lỗi |
| Automated Testing | Còn hạn chế | Có e2e cho lỗi publish; chưa thấy đầy đủ test HTTP auth và test React Testing Library theo đặc tả |
| DevOps/Môi trường local | Hoàn thành một phần | Có PostgreSQL, Redis và MailHog; Dockerfile và CI/CD triển khai vẫn cần hoàn thiện |
| Execution Engine | Chưa hiện thực | Chưa thuộc phạm vi triển khai tuần này |
| Connector/Monitor/Logs | Chưa hiện thực | Mới dừng ở schema và định hướng ban đầu |

---

## 6. Vấn đề tồn tại và hướng cải thiện

### 6.1. Validate workflow mới ở mức cơ bản

Luồng publish hiện kiểm tra trigger, action và node rời. Các kiểm tra sâu hơn, đặc biệt là required fields trong cấu hình node, kiểu dữ liệu giữa các node và expression, chưa được hoàn thiện.

### 6.2. Trải nghiệm lỗi publish cần trực quan hơn

Frontend đang hiển thị thông báo lỗi validate ở mức tổng quát. Cần ánh xạ lỗi tới từng node, làm nổi bật node lỗi trên canvas và thay `alert` thành toast thống nhất.

### 6.3. Phạm vi kiểm thử chưa tương xứng với chức năng mới

Đặc tả đã đề xuất integration test cho auth, Redis/PostgreSQL và component/user-flow test cho frontend; hiện mới có e2e cho trường hợp publish thiếu trigger. Cần bổ sung các test cho OTP, refresh token, RBAC, reset password, publish thành công và UI auth/publish.

### 6.4. Bảo mật và vận hành production cần tiếp tục củng cố

Cấu hình SMTP, JWT và Redis hiện phụ thuộc vào biến môi trường. Trước khi triển khai thật cần quản lý secret an toàn, cấu hình SMTP relay hợp lệ, chính sách rate limit cho OTP/login và cơ chế thu hồi phiên khi cần.

### 6.5. Chức năng hậu publish chưa có

Workflow version đã được tạo nhưng chưa có execution engine, so sánh version, rollback hoặc màn hình quản lý lịch sử version.

---

## 7. Hướng xử lý đề xuất

- Mở rộng workflow validation cho required fields, cấu trúc graph và dữ liệu cấu hình node.
- Hiển thị lỗi theo node trên React Flow, thống nhất toast và trạng thái loading/error khi publish.
- Viết integration test cho toàn bộ API auth và publish, sử dụng Redis/PostgreSQL test; thêm component test cho AuthModal và DesignerPage.
- Bảo vệ endpoint workflow bằng JWT/RBAC và loại bỏ các dữ liệu owner hard-code còn lại.
- Bổ sung rate limiting, giới hạn gửi lại OTP và audit log cho các thao tác xác thực quan trọng.
- Hoàn thiện README, Dockerfile và CI để môi trường local/test/deploy nhất quán.
- Thiết kế luồng Execution Engine sử dụng snapshot `WorkflowVersion` đã publish.

---

## 8. Kế hoạch tuần tiếp theo

Mục tiêu tuần tiếp theo là ổn định, kiểm thử các chức năng publish và authentication, sau đó bắt đầu phát triển luồng thực thi workflow dựa trên version đã publish.

### Công việc dự kiến

- Bổ sung kiểm thử backend cho đăng ký, OTP, login, refresh token, `/me`, reset password và RBAC.
- Bổ sung test publish thành công, version number và việc xóa validation errors sau autosave.
- Hoàn thiện validate graph và hiển thị lỗi theo node trên Designer.
- Bảo vệ API workflow bằng người dùng đang đăng nhập thay cho owner ID cố định.
- Bổ sung rate limit và xử lý lỗi/thông báo xác thực thống nhất.
- Hoàn thiện tài liệu cấu hình Redis, MailHog, SMTP và JWT.
- Bắt đầu hiện thực Execution Module: chọn version đã publish, tạo execution và ghi nhận trạng thái node cơ bản.

### Sản phẩm dự kiến bàn giao

- Bộ kiểm thử tối thiểu cho các luồng Authentication và Publish Workflow.
- Designer có validate trực quan hơn và luồng publish ổn định.
- API workflow có xác thực người dùng cơ bản.
- Nền tảng ban đầu cho việc thực thi một workflow version đã publish.

---

## 9. Tự đánh giá tiến độ

- **Mức độ hoàn thành mục tiêu tuần:** 100%.
- **Mức độ hoàn thành toàn bộ đề tài:** khoảng 35–40%.

### Cơ sở ước lượng

So với tuần 01, dự án đã hoàn thiện thêm hai luồng trọng yếu: người dùng có thể tạo và quản lý phiên đăng nhập an toàn; workflow có thể được kiểm tra và publish thành phiên bản bất biến. Đây là tiền đề trực tiếp để xây dựng execution engine.

Tuy nhiên, các khối lượng lớn vẫn chưa được hiện thực hoặc chưa hoàn thiện:

- Execution Engine và cơ chế retry/timeout.
- Connector Framework và quản lý credential.
- Execution Monitor, Workflow Logs.
- So sánh, rollback version.
- Bộ kiểm thử nghiệp vụ đầy đủ và hạ tầng triển khai production.

### Đánh giá chung

Tuần 02 đã chuyển dự án từ prototype Designer sang nền tảng có xác thực người dùng và quản lý version workflow. Ưu tiên tiếp theo là tăng độ tin cậy bằng kiểm thử, hoàn thiện quyền truy cập và bắt đầu luồng thực thi dựa trên phiên bản đã publish.

---

## 10. Nội dung ngắn gọn để đăng lên cổng

Trong tuần 02, em đã hoàn thiện chức năng Publish Workflow và xây dựng phân hệ Authentication/RBAC cho CrabFlowPilot. Workflow Designer đã có nút Publish; backend kiểm tra graph phải có đúng một trigger, ít nhất một action và không có node rời. Khi hợp lệ, hệ thống tạo snapshot bất biến trong `workflow_versions`, tự tăng số phiên bản và cập nhật phiên bản hiện hành; khi không hợp lệ, lỗi được lưu vào draft và hiển thị trên giao diện. Em cũng xây dựng các API xác thực gồm gửi/xác minh OTP, đăng ký, đăng nhập, refresh token, lấy thông tin người dùng, quên và đặt lại mật khẩu. OTP và refresh token được lưu tạm trên Redis, mật khẩu được băm bcrypt, JWT mang theo role để hỗ trợ RBAC; Nodemailer và MailHog phục vụ gửi email trong môi trường local. Frontend đã có trang chủ, modal đăng nhập/đăng ký/quên mật khẩu, kiểm tra độ mạnh mật khẩu, menu người dùng và Axios interceptor tự gắn/refresh token. Trong quá trình phát triển, nhóm sử dụng một số agent skills của Matt Pocock trong thư mục `.agents` để hỗ trợ đặc tả, coding workflow, kiểm thử, review và xử lý lỗi. Tuần tới, em sẽ bổ sung kiểm thử cho các luồng auth/publish, hoàn thiện hiển thị lỗi theo node, bảo vệ API workflow bằng JWT/RBAC và bắt đầu phát triển Execution Module.
