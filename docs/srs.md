# Software Requirements Specification (SRS)
# FlowPilot – Nền Tảng Workflow Automation

**Phiên bản:** 1.0
**Phạm vi tài liệu:** Các chức năng thuộc "Phạm vi dự án" hiện tại (không bao gồm FlowPilot AI và các hạng mục "Phase Sau")

---

## 1. Giới thiệu

### 1.1 Mục đích tài liệu

Tài liệu này đặc tả chi tiết các yêu cầu chức năng và phi chức năng của hệ thống FlowPilot ở giai đoạn triển khai hiện tại, làm cơ sở cho việc thiết kế, phát triển và kiểm thử hệ thống. Tài liệu tập trung vào các module đã được xác định nằm trong phạm vi dự án; các tính năng AI và các hạng mục dự kiến phát triển về sau được trình bày riêng ở mục 6 (Hướng phát triển) chỉ mang tính định hướng, không phải yêu cầu bắt buộc triển khai ở giai đoạn này.

### 1.2 Phạm vi sản phẩm

FlowPilot là nền tảng workflow automation cho phép người dùng thiết kế, thực thi, giám sát và bảo trì các quy trình nghiệp vụ thông qua giao diện kéo thả (drag & drop). Ở giai đoạn hiện tại, hệ thống triển khai đầy đủ vòng đời của một workflow: **thiết kế → publish → thực thi → giám sát → ghi log → quản lý phiên bản**, thông qua các module:

- Workflow Designer
- Node Library
- Connector Framework
- Workflow Execution Engine
- Execution Monitor
- Workflow Logs
- Workflow Version Management

**Ngoài phạm vi** giai đoạn này: FlowPilot AI (generate/explain/review/optimize workflow bằng AI), Marketplace, Distributed Workflow Engine, Multi-region Deployment, hỗ trợ diện rộng connector (chỉ giới hạn danh sách MVP).

### 1.3 Định nghĩa, từ viết tắt

| Thuật ngữ | Giải thích |
| --- | --- |
| Workflow | Một quy trình nghiệp vụ được mô hình hóa bằng chuỗi các node liên kết với nhau |
| Node | Đơn vị xử lý nhỏ nhất trong workflow (trigger, logic, data processing, integration) |
| Connector | Thành phần plugin cho phép workflow kết nối tới dịch vụ/hệ thống bên ngoài |
| Execution | Một lần thực thi cụ thể của workflow |
| Modular Monolith | Kiến trúc backend triển khai như một ứng dụng duy nhất nhưng được chia thành các module độc lập theo domain, có ranh giới rõ ràng, sẵn sàng tách thành microservice khi cần |
| MVP | Minimum Viable Product |

### 1.4 Tài liệu tham khảo

- FlowPilot – Nền Tảng Workflow Automation Hiện Đại (tài liệu mô tả sản phẩm/PRD nội bộ)

---

## 2. Mô tả tổng quan

### 2.1 Bối cảnh sản phẩm

FlowPilot được xây dựng như một hệ thống độc lập, kiến trúc mở, cho phép mở rộng thêm connector, node và các khả năng AI trong tương lai mà không cần tái thiết kế lại phần lõi (core execution engine).

### 2.2 Đối tượng sử dụng

| Vai trò | Mô tả |
| --- | --- |
| Workflow Developer / Business User | Thiết kế, publish, theo dõi và bảo trì workflow trên Workflow Designer |
| Administrator | Quản lý hệ thống, connector, người dùng và phân quyền |

### 2.3 Giả định và ràng buộc

- Hệ thống triển khai dạng single-region, single-instance ở giai đoạn hiện tại (không yêu cầu multi-region).
- Danh sách connector giới hạn theo bộ MVP (mục 3.3).
- Không hỗ trợ cộng tác nhiều người dùng chỉnh sửa đồng thời (real-time collaboration) trên cùng một workflow.
- Backend phải được thiết kế theo kiến trúc **modular monolith**, phân chia rõ ràng theo bounded context, nhằm đảm bảo khả năng tách thành microservice ở các giai đoạn sau mà không phải viết lại logic nghiệp vụ.

---

## 3. Yêu cầu chức năng

Mỗi yêu cầu được đánh mã `FR-<module>-<số thứ tự>` để tiện truy vết trong quá trình phát triển và kiểm thử.

### 3.1 Workflow Designer

| Mã | Yêu cầu | Mô tả |
| --- | --- | --- |
| FR-WD-01 | Tạo workflow mới | Người dùng có thể tạo một workflow trống với tên, mô tả |
| FR-WD-02 | Chỉnh sửa workflow | Người dùng có thể mở lại workflow đã tạo (kể cả bản draft) để chỉnh sửa |
| FR-WD-03 | Drag & Drop node | Người dùng kéo thả node từ Node Library vào canvas thiết kế |
| FR-WD-04 | Kết nối node | Người dùng vẽ liên kết (edge) giữa các node để xác định luồng xử lý |
| FR-WD-05 | Cấu hình node | Người dùng nhập tham số cấu hình cho từng node (input, mapping dữ liệu…) |
| FR-WD-06 | Validate workflow | Hệ thống kiểm tra workflow trước khi publish: node mồ côi, thiếu cấu hình bắt buộc, vòng lặp không hợp lệ, node không có trigger đầu vào |
| FR-WD-07 | Publish workflow | Chỉ workflow hợp lệ (pass validate) mới được publish và chuyển sang trạng thái có thể thực thi |
| FR-WD-08 | Lưu draft | Workflow chưa hoàn chỉnh có thể được lưu tạm dưới dạng draft, không publish |

### 3.2 Node Library

| Mã | Yêu cầu | Mô tả |
| --- | --- | --- |
| FR-NL-01 | Danh mục node theo nhóm | Hệ thống hiển thị node theo 4 nhóm: Trigger, Logic, Data Processing, Integration |
| FR-NL-02 | Trigger node | Hỗ trợ tối thiểu: Schedule (cron), Webhook, Manual trigger |
| FR-NL-03 | Logic node | Hỗ trợ: Condition (if/else), Branch, Loop |
| FR-NL-04 | Data Processing node | Hỗ trợ: biến đổi dữ liệu (transform), lọc (filter), ánh xạ (mapping) |
| FR-NL-05 | Integration node | Node gọi tới các connector đã cấu hình (mục 3.3) |
| FR-NL-06 | Tìm kiếm node | Người dùng tìm kiếm node theo tên/nhóm trong thư viện |

### 3.3 Connector Framework

| Mã | Yêu cầu | Mô tả |
| --- | --- | --- |
| FR-CF-01 | Kiến trúc plugin connector | Connector được xây dựng theo interface chuẩn để dễ bổ sung connector mới sau này |
| FR-CF-02 | Danh sách connector MVP | HTTP, Webhook, PostgreSQL, Gmail, Google Sheet, Google Drive, Slack, OpenAI |
| FR-CF-03 | Quản lý credential | Người dùng/Administrator cấu hình và lưu trữ thông tin xác thực (API key, OAuth) cho từng connector một cách an toàn (mã hóa) |
| FR-CF-04 | Kiểm tra kết nối | Cho phép test kết nối tới connector trước khi sử dụng trong workflow |

### 3.4 Workflow Execution Engine

| Mã | Yêu cầu | Mô tả |
| --- | --- | --- |
| FR-EX-01 | Sequential Execution | Thực thi các node tuần tự theo luồng đã thiết kế |
| FR-EX-02 | Conditional Branch | Thực thi rẽ nhánh dựa trên kết quả node Logic |
| FR-EX-03 | Parallel Execution | Hỗ trợ thực thi song song nhiều nhánh độc lập |
| FR-EX-04 | Retry | Tự động thử lại node thất bại theo số lần và khoảng thời gian cấu hình |
| FR-EX-05 | Timeout | Node vượt quá thời gian cấu hình sẽ được đánh dấu thất bại (timeout) |
| FR-EX-06 | Error Handling | Cho phép cấu hình hành vi khi node lỗi: dừng workflow, bỏ qua, hoặc chuyển hướng xử lý lỗi |
| FR-EX-07 | Kích hoạt thực thi | Workflow được kích hoạt qua trigger (schedule/webhook/manual) tương ứng đã cấu hình |

### 3.5 Execution Monitor

| Mã | Yêu cầu | Mô tả |
| --- | --- | --- |
| FR-EM-01 | Trạng thái thời gian thực | Hiển thị trạng thái Running / Success / Failed của từng lần thực thi |
| FR-EM-02 | Thời gian thực thi | Hiển thị execution time của toàn bộ workflow và từng node |
| FR-EM-03 | Số lần retry | Hiển thị số lần retry đã thực hiện cho từng node trong 1 execution |
| FR-EM-04 | Danh sách execution | Liệt kê các lần thực thi gần nhất theo workflow, có thể lọc theo trạng thái |

### 3.6 Workflow Logs

| Mã | Yêu cầu | Mô tả |
| --- | --- | --- |
| FR-LG-01 | Ghi input/output | Lưu lại input/output của từng node trong mỗi lần thực thi |
| FR-LG-02 | Ghi trạng thái | Lưu trạng thái (success/failed) từng bước thực thi |
| FR-LG-03 | Ghi thời gian | Lưu thời gian bắt đầu/kết thúc của từng node và toàn workflow |
| FR-LG-04 | Ghi lỗi | Lưu chi tiết lỗi (error message, stack trace nếu có) khi node thất bại |
| FR-LG-05 | Tra cứu log | Cho phép tìm kiếm/lọc log theo workflow, thời gian, trạng thái |

### 3.7 Workflow Version Management

| Mã | Yêu cầu | Mô tả |
| --- | --- | --- |
| FR-VM-01 | Lưu phiên bản | Mỗi lần publish tạo ra một version mới, không ghi đè version cũ |
| FR-VM-02 | So sánh phiên bản | Người dùng có thể so sánh sự khác biệt giữa 2 version của cùng workflow |
| FR-VM-03 | Rollback | Cho phép khôi phục workflow về một version trước đó |

---

## 4. Yêu cầu phi chức năng

| Mã | Nhóm | Yêu cầu |
| --- | --- | --- |
| NFR-01 | Kiến trúc | Backend được xây dựng theo kiến trúc **modular monolith**: chia module theo bounded context (Designer, Execution, Connector, Logging, Versioning…), giao tiếp nội bộ qua interface/service layer rõ ràng, hạn chế phụ thuộc chéo trực tiếp vào tầng dữ liệu của module khác — nhằm đảm bảo khi cần tách microservice trong tương lai, chỉ cần tách theo ranh giới module sẵn có mà không phải viết lại business logic |
| NFR-02 | Hiệu năng | Engine phải xử lý được thực thi song song (parallel execution) mà không chặn (block) các workflow khác đang chạy |
| NFR-03 | Độ tin cậy | Cơ chế retry/timeout/error handling phải đảm bảo một node lỗi không làm crash toàn bộ engine |
| NFR-04 | Bảo mật | Credential của connector phải được mã hóa khi lưu trữ; không log giá trị nhạy cảm (API key, token) ra Workflow Logs |
| NFR-05 | Khả năng bảo trì | Node Library và Connector Framework thiết kế dạng plugin để bổ sung node/connector mới không ảnh hưởng đến core engine |
| NFR-06 | Khả năng quan sát (observability) | Execution Monitor và Workflow Logs phải phản ánh đúng thời gian thực (hoặc gần thời gian thực) trạng thái thực thi |
| NFR-07 | Khả năng mở rộng | Kiến trúc dữ liệu (đặc biệt bảng lưu execution/log) phải chịu được tăng trưởng số lượng execution theo thời gian mà không suy giảm hiệu năng truy vấn nghiêm trọng |

---

## 5. Kiến trúc hệ thống (tổng quan)

Hệ thống được triển khai theo mô hình **modular monolith** ở tầng backend, với các module nghiệp vụ độc lập tương ứng với các chức năng ở mục 3:

- **Designer Module**: quản lý workflow definition, validate, publish
- **Execution Module**: engine thực thi workflow (sequential/parallel/branch, retry, timeout, error handling)
- **Connector Module**: quản lý connector, credential, kết nối dịch vụ ngoài
- **Monitoring Module**: theo dõi trạng thái execution thời gian thực
- **Logging Module**: ghi nhận input/output/lỗi của execution
- **Versioning Module**: quản lý version, compare, rollback

Mỗi module được tổ chức với ranh giới rõ ràng (own service layer, own data access), giao tiếp với nhau qua interface nội bộ trong cùng codebase/process. Cách tổ chức này giúp:

- Triển khai và vận hành đơn giản ở giai đoạn đầu (một artifact deploy duy nhất).
- Dễ dàng tách module thành microservice độc lập sau này (ví dụ: Execution Module có thể tách riêng trước tiên do đặc thù tải nặng/cần scale độc lập) mà không cần viết lại logic nghiệp vụ, chỉ cần thay đổi lớp giao tiếp (từ gọi hàm nội bộ sang gọi qua API/message queue).

---

## 6. Hướng phát triển sau này ("Phase Sau")

Các hạng mục dưới đây **không thuộc phạm vi triển khai hiện tại**, được liệt kê nhằm định hướng kiến trúc mở, tránh thiết kế gây cản trở khi mở rộng về sau:

- **FlowPilot AI**: Generate Workflow (gợi ý cấu trúc workflow từ mô tả ngôn ngữ tự nhiên), Explain Workflow, Review Workflow (cảnh báo thiếu error handling, node thừa, vòng lặp vô hạn…), Suggest Optimization.
- **AI Chat Assistant** tích hợp trực tiếp trong Workflow Designer.
- **Marketplace** chia sẻ workflow giữa người dùng.
- **Human-in-the-loop**: cho phép workflow tạm dừng chờ xác nhận thủ công giữa các bước.
- **AI Debugger**: hỗ trợ AI phân tích nguyên nhân lỗi execution.
- **Workflow Template Gallery**.
- **Local LLM**: giảm phụ thuộc vào nhà cung cấp AI bên thứ ba (hiện tại là OpenAI API).
- **Đa dạng hóa Workflow Engine** thông qua Workflow Intermediate Representation (Workflow IR), cho phép chạy cùng một workflow definition trên nhiều engine khác nhau.
- **Distributed Workflow Engine** và **Multi-region Deployment** khi quy mô người dùng/tải hệ thống tăng.
- **Mở rộng danh sách connector** ngoài bộ MVP hiện tại.
- **Tách module Execution/Connector thành microservice độc lập**, tận dụng ranh giới đã được thiết kế sẵn trong kiến trúc modular monolith ở mục 5.