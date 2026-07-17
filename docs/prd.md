# Product Requirements Document (PRD)
# FlowPilot – Nền Tảng Workflow Automation Hiện Đại

---

Note: những phần đánh dấu là “Phase Sau” sẽ được phát triển sau

# 1. Giới thiệu

## 1.1 Tổng quan

FlowPilot là một nền tảng Workflow Automation cho phép người dùng thiết kế, thực thi, giám sát và bảo trì các quy trình nghiệp vụ (workflow) thông qua giao diện kéo thả (Drag & Drop) trực quan. Trọng tâm của FlowPilot là cung cấp một công cụ tự động hóa quy trình mạnh mẽ, ổn định và dễ mở rộng.

FlowPilot tích hợp thêm **FlowPilot AI** như một trợ lý (copilot) giúp người dùng tạo, giải thích và tối ưu workflow nhanh hơn. AI là một tính năng bổ sung có giá trị, không phải là thành phần bắt buộc để hệ thống vận hành — người dùng vẫn có thể xây dựng và chạy toàn bộ workflow mà không cần dùng đến AI.

## 1.2 Mục tiêu

- Cung cấp công cụ xây dựng workflow trực quan, dễ dùng cho cả người có và không có nền tảng kỹ thuật.
- Đơn giản hóa việc tích hợp và kết nối nhiều hệ thống/dịch vụ khác nhau.
- Đảm bảo thực thi workflow ổn định, có khả năng xử lý lỗi và retry.
- Tăng khả năng bảo trì, theo dõi và mở rộng workflow theo thời gian.
- Tích hợp AI như một công cụ hỗ trợ giúp rút ngắn thời gian thiết kế và phát hiện vấn đề trong workflow (“Phase Sau”).

---

# 2. Đối tượng sử dụng

### Workflow Developer, Business User

Thiết kế, triển khai và bảo trì workflow; là người dùng chính, thao tác trực tiếp trên Workflow Designer.

(“Phase Sau”) Theo dõi trạng thái workflow, và có thể tận dụng FlowPilot AI để mô tả nhu cầu bằng ngôn ngữ tự nhiên mà không cần hiểu sâu về kỹ thuật.

### Administrator

Quản lý hệ thống, connector, người dùng và phân quyền.

---

# 3. Phạm vi dự án

## Bao gồm

- Workflow Designer (kéo thả)
- Workflow Execution Engine
- Node Library
- Connector Framework
- Execution Monitor
- Workflow Logs
- Workflow Version Management
- FlowPilot AI (“Phase Sau”)

## Không bao gồm

- Marketplace
- Distributed Workflow Engine
- Multi-region Deployment
- Hỗ trợ hàng trăm connector
- Tạo workflow bằng ngôn ngữ tự nhiên bằng AI
- AI tự động triển khai hoặc chỉnh sửa workflow trực tiếp trên Production

---

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
- PostgreSQL
- Gmail
- Google sheet
- Google drive
- Slack
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

## 4.8 FlowPilot AI (“Phase Sau”)

FlowPilot AI là một lớp tiện ích tùy chọn, giúp tăng tốc quá trình làm việc với workflow.

- **Generate Workflow**: Gợi ý cấu trúc workflow từ mô tả bằng ngôn ngữ tự nhiên (người dùng vẫn cần rà soát và chỉnh sửa trước khi publish).
- **Explain Workflow**: Diễn giải workflow theo ngôn ngữ nghiệp vụ, dễ hiểu cho Business User.
- **Review Workflow**: Phân tích và cảnh báo các vấn đề tiềm ẩn (thiếu error handling, node thừa, vòng lặp vô hạn…).
- **Suggest Optimization**: Đề xuất cải thiện về hiệu năng, cấu trúc và xử lý lỗi.

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

FlowPilot tập trung xây dựng một nền tảng Workflow Automation vững chắc, dễ dùng và dễ mở rộng, giúp người dùng thiết kế, thực thi và giám sát quy trình nghiệp vụ một cách hiệu quả. FlowPilot AI giúp tăng tốc công việc. Trong phạm vi đồ án, hệ thống tập trung triển khai các tính năng cốt lõi của một nền tảng workflow, đồng thời được thiết kế theo kiến trúc mở để dễ dàng tích hợp thêm AI và các khả năng khác trong tương lai.