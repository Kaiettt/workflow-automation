# BÁO CÁO TIẾN ĐỘ TUẦN 09

## 1. Thông tin chung

- **Tên đề tài:** CrabFlowPilot – Nền tảng thiết kế và tự động hóa quy trình (Workflow Automation)
- **Học kỳ:** Học kỳ 1, năm học 2026–2027
- **Tuần báo cáo:** Tuần 09
- **Thời gian báo cáo:** 02/11/2026 – 08/11/2026
- **Sinh viên thực hiện:**
  - Nguyễn Anh Kiệt – MSSV: 23110246
  - Nguyễn Văn Hiếu – MSSV: 23110214
- **Giảng viên hướng dẫn:** ThS. Nguyễn Hữu Trung
- **Mã nguồn dự án:** `workflow-automation`
- **Nhánh làm việc:** `master`
- **Ngày chốt số liệu:** 10/11/2026 (theo các bản tổng kết kỹ thuật được cập nhật trong repository)

---

## 2. Mục tiêu của tuần

Sau khi hoàn thiện các chức năng thực thi workflow và tích hợp trigger trong giai đoạn trước, trọng tâm của Tuần 09 là **nâng cao khả năng bảo trì, kiểm thử và mở rộng của hệ thống thông qua việc chuẩn hóa kiến trúc Backend và Frontend**. Nhóm tập trung xử lý các thành phần có trách nhiệm quá lớn, giảm phụ thuộc trực tiếp giữa các tầng, chuẩn hóa cách truy vấn/cập nhật dữ liệu và tách logic giao tiếp thời gian thực khỏi phần nghiệp vụ.

Các mục tiêu chính:

1. **Tái cấu trúc Backend Execution Engine:** tách các trách nhiệm ghi log/phát sự kiện, phân giải cấu hình và thực thi node thành các collaborator/strategy độc lập.
2. **Đồng bộ Backend với CQRS và Clean Architecture:** chuyển các thao tác đọc workflow sang Query/Handler, chuẩn hóa DTO và sử dụng cơ chế SSE theo cách triển khai của NestJS.
3. **Chuẩn hóa Frontend Data Layer:** đưa truy vấn và mutation về TanStack React Query hooks; tách cơ chế kết nối Server-Sent Events thành module riêng.
4. **Phân rã các Frontend component lớn:** chia các trang phức tạp thành component và custom hook có trách nhiệm rõ ràng, đồng thời tái sử dụng renderer node.
5. **Bảo đảm không thay đổi hành vi người dùng:** duy trì API contract, giao diện và luồng nghiệp vụ hiện có trong quá trình refactor; bổ sung kiểm thử hồi quy.

---

## 3. Nội dung công việc đã thực hiện

### 3.1. Tái cấu trúc Backend Execution Engine

Nhóm thực hiện refactor tại `monolith-backend/libs/execution`, tập trung vào `WorkflowEngine` và `NodeRunner`. Trước khi thay đổi, các lớp này đồng thời xử lý nhiều trách nhiệm như chuẩn bị cấu hình, gọi executor, ghi nhận trạng thái node, phát sự kiện realtime và xử lý lỗi. Cách tổ chức này khiến việc kiểm thử từng phần và bổ sung chiến lược thực thi mới trở nên khó khăn.

Các thay đổi chính:

- **Tách `NodeExecutionObserver`:**
  - Tập trung việc ghi node log vào repository và phát sự kiện SSE.
  - Cung cấp các hàm theo vòng đời node: `notifyStarted`, `notifyCompleted`, `notifyFailed`, `notifySkipped`.
  - Chuẩn hóa việc làm sạch thông tin nhạy cảm trong lỗi trước khi lưu log.
  - Ghi nhận thời gian thực thi, trạng thái và tiến độ item khi node thất bại.

- **Tách `NodeConfigResolver`:**
  - Chịu trách nhiệm phân giải credential và kiểm tra định danh credential.
  - Áp dụng giá trị mặc định theo schema.
  - Tạo expression context và phân giải cấu hình node trước khi thực thi.

- **Tách Execution Strategies:**
  - `OnceExecutionStrategy`: xử lý executor chạy một lần cho toàn bộ đầu vào.
  - `PerItemExecutionStrategy`: xử lý executor theo từng item, giới hạn số lượng item, định tuyến `RoutedItem` và ghi nhận lỗi một phần.

- **Tinh gọn `NodeRunner`:**
  - Chuyển phần lớn logic điều phối sang resolver, observer và strategy.
  - `NodeRunner` giảm từ **326 dòng xuống 150 dòng**, tập trung vào điều phối vòng đời thực thi node.
  - Bổ sung dependency injection và factory hỗ trợ khởi tạo trong kiểm thử.

- **Điều chỉnh `WorkflowEngine` và module DI:**
  - Chuyển việc ghi log node bị bỏ qua sang observer.
  - Loại bỏ các đoạn ghi log/phát sự kiện trùng lặp.
  - Đăng ký các service, strategy và executor map trong `ExecutionModule`.
  - Giữ khả năng tương thích với cách khởi tạo cũ trong các unit test hiện có.

Kết quả: các trách nhiệm trong execution pipeline được tách biệt rõ hơn, thuận tiện cho việc thay đổi từng chiến lược thực thi và kiểm thử độc lập mà không phải phụ thuộc toàn bộ engine.

### 3.2. Chuẩn hóa CQRS và Clean Architecture ở Backend

Nhóm tiếp tục chuẩn hóa tầng Presentation của module Designer và Execution nhằm giảm việc Controller truy cập trực tiếp repository hoặc tự xử lý chi tiết transport.

**Module Designer:**

- Bổ sung các DTO phục vụ truy vấn:
  - `WorkflowSummaryDto`
  - `WorkflowVersionSummaryDto`
  - `WorkflowVersionDetailDto`
- Bổ sung các query và handler:
  - `GetWorkflowsQuery`
  - `GetWorkflowVersionsQuery`
  - `GetWorkflowVersionQuery`
- Refactor `WorkflowsController`: loại bỏ dependency trực tiếp vào `WorkflowRepository` và `WorkflowVersionRepository` đối với các thao tác đọc.
- Chuyển các thao tác đọc danh sách workflow, danh sách version và chi tiết version sang `queryBus.execute()`.
- Chuẩn hóa kiểu dữ liệu generic cho các lệnh/query, giảm việc phải vô hiệu hóa quy tắc ESLint liên quan đến unsafe assignment.
- Đăng ký các query handler trong `DesignerModule`.

**Module Execution – SSE:**

- Tạo `ExecutionStreamService` để quản lý luồng `Observable<MessageEvent>`.
- Service chịu trách nhiệm lấy snapshot execution ban đầu, đăng ký nhận event, gửi heartbeat định kỳ và dọn dẹp subscription/timer.
- Tự kết thúc stream khi execution chuyển sang trạng thái cuối như `SUCCESS`, `FAILED` hoặc `CANCELLED`.
- Refactor `ExecutionController` từ cách ghi response thủ công qua Express `@Res()` sang decorator `@Sse()` của NestJS.

**Chuẩn hóa kiểu dữ liệu:**

- Siết chặt TypeScript typing trong `workflow-validation.util.ts`.
- Hạn chế việc sử dụng kiểu không an toàn khi xử lý dữ liệu workflow validation.

Kết quả: Controller tập trung vào tiếp nhận request và trả response; nghiệp vụ truy vấn được điều phối qua CQRS, còn cơ chế streaming được đóng gói riêng trong application service.

### 3.3. Chuẩn hóa Frontend Data Layer

Nhóm chuẩn hóa cách Frontend giao tiếp với Backend tại `frontend/src/features/workflow`.

**Tách SSE client:**

- Tạo `sse-client.ts` với `SseConnectionManager` để quản lý kết nối streaming.
- Đóng gói việc đọc `ReadableStream`, giải mã và phân tách SSE frame.
- Bổ sung cơ chế loại bỏ event trùng lặp bằng bộ nhớ đệm giới hạn 500 event ID.
- Bổ sung reconnect với exponential backoff và jitter.
- Phân biệt lỗi HTTP có thể retry và lỗi 4xx mang tính cố định (ngoại trừ 408/429).
- Hỗ trợ hủy kết nối bằng `AbortController`.
- Rút gọn `execution.service.ts` từ **286 dòng xuống 88 dòng**, chuyển phần transport SSE sang client chuyên biệt trong khi vẫn giữ các hàm service hiện có.

**Chuẩn hóa React Query:**

- Tạo `useWorkflowMutations.ts` với các mutation hook cho tạo workflow, tạo từ template, đổi tên, xóa, lưu draft và publish.
- Tạo `useWorkflowDraft.ts` để quản lý truy vấn draft và node types.
- Sử dụng `queryClient.invalidateQueries` để đồng bộ cache sau mutation thay vì gọi `refetch()` thủ công.
- Trạng thái loading được suy ra từ trạng thái mutation (`isPending`) thay vì duy trì nhiều state boolean riêng.

**Chuẩn hóa component:**

- `WorkflowListPage.tsx` không còn gọi trực tiếp `workflowService`; thay `alert()` bằng thông báo giao diện có thể truy cập.
- `DesignerPage.tsx` sử dụng query/mutation hooks thay cho các API call và `useEffect` thủ công.
- Thay các hộp thoại native `window.confirm` bằng Dialog component của shadcn/ui.

Kết quả: data fetching, mutation, cache invalidation và streaming transport có ranh giới rõ ràng; component giao diện giảm trách nhiệm điều phối dữ liệu.

### 3.4. Phân rã Frontend component lớn

Nhóm tiếp tục xử lý các component có kích thước lớn và nhiều trách nhiệm, áp dụng Feature-Based Architecture và nguyên tắc single responsibility.

- **Tái sử dụng renderer node:**
  - Hợp nhất `RunnerNodeComponent` và `PreviewNodeComponent` thành `ExecutionCanvasNode`.
  - Chuẩn hóa cách hiển thị icon, trạng thái node, handles và phần output/error có thể mở rộng.

- **Phân rã `VersionDetailPage.tsx`:**
  - Giảm từ **951 dòng xuống 226 dòng**.
  - Tách các component: `VersionHeader`, `ExecutionControlBar`, `ExecutionResultStats`, `VersionCanvas`, `ExecutionNodeLogTable`, `NodeLogDetailAccordion`, `VersionStructureCard`.
  - Tách `useExecutionMonitor` để quản lý SSE subscription, polling dự phòng, mutation chạy workflow và cập nhật cache.
  - Tách `version-canvas.util.ts` để chuyển đổi dữ liệu node sang cấu trúc canvas.

- **Phân rã `WorkflowListPage.tsx`:**
  - Giảm từ **355 dòng xuống 244 dòng**.
  - Tách `DeleteWorkflowDialog` và `WorkflowTable`.

- **Tối ưu `DesignerPage.tsx`:**
  - Tách `useDraftAutoSave` để quản lý debounce, bỏ qua lần tải đầu và lưu ngay khi cần.
  - Đơn giản hóa luồng publish và áp dụng template.

- **Phân rã `WorkflowCanvasPreview.tsx`:**
  - Giảm từ **620 dòng xuống 311 dòng**.
  - Tách `usePreviewSimulation` để quản lý timer, log accumulator và trạng thái drawer.
  - Tái sử dụng `ExecutionCanvasNode` thay cho custom node viết trực tiếp trong trang.

Kết quả: các trang lớn được chia thành component/hook nhỏ hơn, dễ đọc, kiểm thử và tái sử dụng; mục tiêu giữ nguyên giao diện và hành vi người dùng được duy trì trong quá trình refactor.

---

## 4. Kết quả kiểm thử và chất lượng

| Hạng mục | Kết quả ghi nhận |
| --- | --- |
| Backend Jest sau refactor Execution Engine | 27 test suites, 342 tests passed |
| Backend ESLint – Execution Engine | 0 errors, 0 warnings |
| Frontend Vitest sau chuẩn hóa Data Layer | 34 test files, 118 tests passed |
| Frontend Vitest sau Component Decomposition | 39 test files, 135 tests passed |
| Frontend ESLint | 0 errors, 0 warnings |
| Backend hồi quy | Các kiểm thử liên quan Designer, Execution và CQRS được chạy lại theo từng giai đoạn |

Các test mới tập trung vào observer, config resolver, execution strategies, NodeRunner, SSE client, React Query hooks, các component và custom hooks vừa được tách. Những kiểm thử này giúp xác minh cả logic độc lập lẫn sự tương tác giữa các lớp sau refactor.

---

## 5. Kết quả đạt được

1. Backend Execution Engine được chia thành các thành phần có trách nhiệm riêng biệt, giảm độ phức tạp của `NodeRunner`.
2. Các thao tác đọc dữ liệu workflow được chuẩn hóa theo CQRS; Controller giảm phụ thuộc trực tiếp vào repository.
3. SSE được đóng gói thành application service ở Backend và transport client ở Frontend.
4. Frontend sử dụng React Query hooks nhất quán hơn cho query, mutation và cache invalidation.
5. Các trang giao diện lớn được phân rã thành component và custom hook, đồng thời tái sử dụng `ExecutionCanvasNode`.
6. Bổ sung nhiều unit/component tests và duy trì kết quả lint sạch trong các phạm vi đã kiểm tra.

---

## 6. Khó khăn và hướng giải quyết

- **Rủi ro thay đổi hành vi khi refactor:** việc di chuyển logic giữa nhiều lớp có thể gây sai lệch trạng thái node, event SSE hoặc cache. Nhóm giải quyết bằng cách giữ contract hiện tại, bổ sung unit test cho từng collaborator/hook và chạy lại các test hồi quy.
- **Quản lý vòng đời SSE:** kết nối streaming cần xử lý reconnect, duplicate event, terminal event và cleanup khi người dùng rời trang. Nhóm tách transport thành module riêng và bổ sung kiểm thử cho các tình huống này.
- **Component quá lớn và phụ thuộc chéo:** nhóm phân rã theo trách nhiệm hiển thị và điều phối, đưa logic có trạng thái vào custom hook, đồng thời dùng component node dùng chung để hạn chế trùng lặp.
- **Tính nhất quán kiến trúc:** nhóm đối chiếu các thay đổi với CQRS, Clean Architecture và Feature-Based Architecture để tránh việc refactor chỉ làm thay đổi vị trí code mà không cải thiện ranh giới trách nhiệm.

---

## 7. Kế hoạch tuần tiếp theo

1. Hoàn thiện khu vực quản trị nền tảng (Admin), ưu tiên role, quyền truy cập và quản lý tài khoản.
2. Kiểm tra kỹ các luồng khóa/mở khóa tài khoản, thu hồi phiên và ảnh hưởng đến execution/trigger.
3. Xây dựng dashboard tổng quan hoạt động hệ thống và kiểm tra tính chính xác của số liệu.
4. Tiếp tục hoàn thiện kiểm thử tích hợp và chuẩn bị tài liệu triển khai/vận hành cho các chức năng Admin.
