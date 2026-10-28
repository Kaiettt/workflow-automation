# Product Requirements Document (PRD)
# FlowPilot – Nền Tảng Workflow Automation Hiện Đại

---

Note: những phần đánh dấu là “Phase Sau” sẽ được phát triển sau

# 1. Giới thiệu

## 1.1. Tổng quan

**FlowPilot** là nền tảng Workflow Automation giúp doanh nghiệp tự động hóa các quy trình công việc lặp đi lặp lại thông qua giao diện kéo thả trực quan. Người dùng có thể thiết kế, vận hành, theo dõi và quản lý các quy trình nghiệp vụ trên cùng một hệ thống mà không cần viết mã đối với các luồng xử lý phổ biến.

### Vấn đề cần giải quyết

Trong thực tế, nhiều quy trình nghiệp vụ phải đi qua nhiều công cụ khác nhau như email, bảng tính, cơ sở dữ liệu hoặc ứng dụng nhắn tin. Các quy trình này thường được thực hiện thủ công hoặc bằng những đoạn script rời rạc.

Cách tiếp cận này dẫn đến nhiều hạn chế:

- Tốn thời gian xử lý.
- Dễ phát sinh sai sót do thao tác thủ công.
- Khó theo dõi trạng thái thực thi.
- Khó bảo trì và mở rộng.
- Phụ thuộc vào một số cá nhân có kiến thức kỹ thuật.

### Giá trị mang lại

1. **Dễ xây dựng**
   - Thiết kế quy trình bằng thao tác kéo thả và kết nối các bước xử lý.
   - Người dùng không chuyên kỹ thuật vẫn có thể tạo workflow cơ bản.

2. **Kết nối nhiều hệ thống**
   - Liên kết các dịch vụ doanh nghiệp đang sử dụng vào cùng một quy trình thống nhất.

3. **Đáng tin cậy**
   - Workflow được thực thi đúng theo thiết kế.
   - Người dùng luôn biết quy trình đang ở trạng thái nào.

4. **Minh bạch và dễ kiểm soát**
   - Mọi lần chạy đều được lưu lịch sử.
   - Mọi thay đổi đều có phiên bản và có thể khôi phục khi cần.

---

## 1.2. Mục tiêu

| Mục tiêu | Tiêu chí thành công (MVP) |
|-----------|---------------------------|
| Giúp mọi người dễ dàng tạo workflow | Người dùng mới có thể tạo và xuất bản một workflow đơn giản trong vòng 10 phút |
| Đáp ứng cả nhu cầu đơn giản lẫn phức tạp | Cùng một nền tảng phục vụ được workflow vài bước và workflow nhiều nhánh, quy mô lớn |
| Kết nối các dịch vụ phổ biến | Hỗ trợ 8 connector trong giai đoạn MVP và dễ dàng mở rộng thêm connector mới |
| Vận hành ổn định, dễ theo dõi | Mọi lần chạy đều hiển thị trạng thái rõ ràng và được lưu lịch sử |
| Dễ bảo trì theo thời gian | Người dùng có thể lưu, so sánh và khôi phục các phiên bản workflow trước đó |

> *Các chỉ số nêu trên là đề xuất ban đầu và có thể điều chỉnh phù hợp với phạm vi đồ án.*

# 2. Đối tượng sử dụng

FlowPilot hướng đến ba nhóm người dùng chính: **Workflow Developer**, **Business User** và **Administrator**.

---

## 2.1. Workflow Developer

### Mô tả

Người có nền tảng kỹ thuật, chịu trách nhiệm thiết kế các workflow phức tạp, quy mô lớn, thường liên quan đến nhiều hệ thống và nhiều nhánh xử lý.

### Nhu cầu

- Xây dựng các quy trình nhiều bước, nhiều điều kiện và nhiều nhánh xử lý.
- Tích hợp với nhiều hệ thống và dịch vụ khác nhau.
- Quản lý, cập nhật và mở rộng workflow theo thời gian.
- Điều tra và xử lý sự cố dựa trên lịch sử chạy.
- Kiểm soát thay đổi thông qua cơ chế phiên bản.
- Khôi phục workflow về phiên bản ổn định khi cần.

### Ví dụ

Thiết kế quy trình xử lý đơn hàng đi qua nhiều hệ thống:

1. Nhận đơn hàng.
2. Kiểm tra tính hợp lệ.
3. Gửi thông báo cho các bên liên quan.
4. Đồng bộ dữ liệu sang hệ thống quản lý kho và CRM.

---

## 2.2. Business User

### Mô tả

Nhân sự nghiệp vụ như vận hành, kinh doanh, marketing hoặc kế toán, có ít hoặc không có nền tảng kỹ thuật nhưng muốn tự động hóa công việc hằng ngày.

### Nhu cầu

- Tự tạo workflow đơn giản mà không cần hỗ trợ từ đội kỹ thuật.
- Sử dụng giao diện dễ hiểu và ít thao tác.
- Theo dõi được trạng thái hoạt động của workflow.
- Nhận cảnh báo khi workflow gặp lỗi.

### Ví dụ

- Tự động gửi thông báo Slack khi có dòng mới trong Google Sheets.
- Tự động lưu tệp đính kèm từ email vào Google Drive.
- Gửi email cảm ơn khi khách hàng điền biểu mẫu đăng ký.

---

## 2.3. Administrator

### Mô tả

Người quản trị hệ thống, chịu trách nhiệm vận hành nền tảng và quản lý người dùng.

### Nhu cầu

- Quản lý các kết nối đến dịch vụ bên ngoài.
- Quản lý tài khoản người dùng.
- Phân quyền truy cập các tài nguyên trong hệ thống.
- Theo dõi tình trạng hoạt động của nền tảng.
- Đảm bảo tính bảo mật và tuân thủ chính sách tổ chức.

### Ví dụ

- Thêm kết nối Google Workspace hoặc Microsoft 365 cho tổ chức.
- Cấp quyền tạo workflow cho nhóm vận hành.
- Thu hồi quyền truy cập của người dùng đã nghỉ việc.

# 3. Phạm vi dự án

## 3.1. Bao gồm (MVP)

| Nhóm | Nội dung |
|--------|----------|
| **Thiết kế workflow** | Workflow Designer cho phép kéo thả để tạo, chỉnh sửa, kiểm tra và xuất bản workflow. |
| **Thư viện thành phần** | Node Library gồm các khối dựng sẵn như Trigger, Condition & Branching, Data Processing và Service Connector. |
| **Kết nối dịch vụ** | Hỗ trợ connector cho 8 dịch vụ phổ biến: HTTP, Webhook, Google Sheet, Gmail, Google Sheets, Google Drive, OpenAI; đồng thời cho phép mở rộng thêm connector mới. |
| **Vận hành workflow** | Workflow Execution Engine thực thi workflow theo đúng luồng đã thiết kế và hỗ trợ cơ chế tự động thử lại (retry) khi gặp lỗi tạm thời. |
| **Theo dõi và giám sát** | Execution Monitor hiển thị trạng thái các lần chạy; Workflow Logs lưu lịch sử thực thi để phục vụ tra cứu và xử lý sự cố. |
| **Quản lý phiên bản** | Lưu phiên bản workflow, so sánh sự khác biệt giữa các phiên bản và khôi phục về phiên bản trước đó. |
| **Quản lý người dùng** | Hỗ trợ đăng nhập, quản lý tài khoản và phân quyền theo vai trò: Administrator, Workflow Developer và Business User. |
| **Quản lý kết nối** | Administrator có thể cấu hình, lưu trữ và quản lý các tài khoản kết nối tới các dịch vụ bên ngoài. |

---

## 3.2. Không bao gồm (Ngoài phạm vi MVP)

Các chức năng dưới đây không nằm trong giai đoạn MVP:

1. Marketplace chia sẻ workflow giữa các tổ chức hoặc người dùng.
2. Hệ thống thực thi workflow phân tán quy mô lớn (distributed execution).
3. Triển khai đa vùng (multi-region deployment).
4. Hỗ trợ hàng trăm connector tích hợp sẵn.
5. Chỉnh sửa workflow theo thời gian thực với nhiều người dùng cùng lúc (real-time collaborative editing).

---

## 3.3. Giới hạn của MVP

Để đảm bảo phạm vi phù hợp với thời gian và nguồn lực thực hiện đồ án, phiên bản MVP tập trung vào:

- Xây dựng nền tảng workflow automation hoàn chỉnh từ thiết kế đến thực thi.
- Hỗ trợ các kiểu workflow phổ biến của doanh nghiệp vừa và nhỏ.
- Đảm bảo khả năng mở rộng kiến trúc để bổ sung connector và tính năng trong tương lai.
- Ưu tiên tính ổn định, khả năng theo dõi và quản lý workflow hơn là tối ưu cho quy mô cực lớn.

# 4. Chức năng chính

## 4.1 Workflow Designer

Giao diện kéo thả cho phép người dùng xây dựng workflow trực quan, không cần viết code.

**Chức năng**

- Tạo workflow mới
- Chỉnh sửa workflow
- Drag & Drop node
- Kết nối các node với nhau
- Validate workflow trước khi publish
- Publish workflow

## 4.2 Node Library

Thư viện node có sẵn để lắp ráp thành workflow.

**Bao gồm**

- Trigger (kích hoạt: schedule, webhook, sự kiện thủ công…)
- Logic (điều kiện, rẽ nhánh, vòng lặp)
- Data Processing (biến đổi, lọc, ánh xạ dữ liệu)
- Integration (kết nối dịch vụ ngoài)
- AI (dùng khi workflow cần xử lý bằng AI — ví dụ tóm tắt văn bản, phân loại nội dung)

## 4.3 Connector Framework

Kiến trúc plugin cho phép workflow kết nối với các dịch vụ bên ngoài.

**MVP Connector**

- HTTP
- Webhook
- Google Sheet
- Gmail
- Google sheet
- Google drive
- OpenAI

## 4.4 Workflow Execution

Engine thực thi workflow theo đúng luồng đã thiết kế, là thành phần lõi của hệ thống.

**Hỗ trợ**

- Sequential Execution
- Conditional Branch
- Parallel Execution
- Retry
- Timeout
- Error Handling

## 4.5 Execution Monitor

Theo dõi trạng thái hoạt động của workflow theo thời gian thực.

**Thông tin hiển thị**

- Running / Success / Failed
- Execution Time
- Retry Count

## 4.6 Workflow Logs

Lưu lịch sử thực thi của workflow phục vụ debug và audit.

**Bao gồm**

- Input / Output
- Status
- Execution Time
- Error

## 4.7 Version Management

Quản lý phiên bản workflow.

**Chức năng**

- Save Version
- Compare Version
- Rollback

---

# 5. Công nghệ sử dụng

## Frontend

- React.js
- TypeScript
- React Flow
- Tailwind CSS
- shadcn/ui

## Backend

- NestJS
- Prisma ORM

## Database

- PostgreSQL
- Redis

## AI

- OpenAI API
- LangChain.js
- RAG
- Workflow Intermediate Representation (Workflow IR)

## DevOps

- Docker
- Docker Compose
- GitHub Actions

---

# 6. Hạn chế

- Chỉ hỗ trợ một số connector phổ biến trong phiên bản MVP.
- Chưa hỗ trợ workflow phân tán quy mô lớn.
- Chưa hỗ trợ cộng tác nhiều người theo thời gian thực.
- Tính năng AI phụ thuộc vào nhà cung cấp mô hình bên thứ ba (OpenAI) và có thể sinh gợi ý chưa hoàn toàn chính xác — người dùng luôn là bên quyết định cuối cùng trước khi publish.

---

# 7. Hướng phát triển

- Bổ sung thêm connector.
- AI Chat Assistant.
- Marketplace chia sẻ workflow.
- Human-in-the-loop.
- AI Debugger.
- Workflow Template Gallery.
- Local LLM (giảm phụ thuộc vào nhà cung cấp AI bên thứ ba).
- Hỗ trợ nhiều Workflow Engine thông qua Workflow IR.

---

# 8. Kết luận

FlowPilot tập trung xây dựng một nền tảng Workflow Automation vững chắc, dễ dùng và dễ mở rộng, giúp người dùng thiết kế, thực thi và giám sát quy trình nghiệp vụ một cách hiệu quả. Trong phạm vi đồ án, hệ thống tập trung triển khai các tính năng cốt lõi của một nền tảng workflow, đồng thời được thiết kế theo kiến trúc mở để dễ dàng tích hợp thêm AI và các khả năng khác trong tương lai.