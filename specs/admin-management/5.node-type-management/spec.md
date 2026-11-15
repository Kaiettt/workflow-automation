# Spec: Quản lý Loại Node (Node Type Management)

Status: ready-for-agent (P1)

## 1. Mục tiêu và Bối cảnh
Cung cấp khả năng quản lý danh mục các khối chức năng (Node Types), theo dõi mức độ sử dụng trong các workflow, và điều phối độc lập giữa việc ẩn khỏi bảng chọn Designer (`isCatalogVisible`) và cấm thực thi ở runtime (`isExecutionAllowed`), bảo đảm các workflow hiện hữu của người dùng không bị gãy đột ngột.

Nguồn yêu cầu: [SRS](../../../docs/srs.md) (FR-NL-*, FR-WD-05, FR-EX-*), [PRD](../../../docs/prd.md).

## 2. Yêu cầu Chức năng (Functional Requirements)

### FR-NM-01: Danh mục và Thống kê Sử dụng Node Type
- API `GET /api/admin/node-types`:
  - Trả về danh sách khối chức năng với các trường: `id`, `key`, `displayName`, `icon`, `color`, `category` (`TRIGGER`, `ACTION`, `LOGIC`, `TRANSFORMATION`, `INTEGRATION`), `connectorKey`, `connectorName`, `isCatalogVisible` (hiển thị trên palette), `isExecutionAllowed` (cho phép chạy runtime), `revision`, `publishedWorkflowCount`, `draftWorkflowCount`, `createdAt`, `updatedAt`.
  - `publishedWorkflowCount`: Số lượng workflow phân biệt đã phát hành (`PUBLISHED`) đang chứa ít nhất một node thuộc loại này.
  - `draftWorkflowCount`: Số lượng workflow nháp (`DRAFT`) đang chứa node thuộc loại này.
  - Hỗ trợ tìm kiếm theo key hoặc tên hiển thị (`q`), lọc theo `category`, lọc theo `connectorId`, lọc theo `isCatalogVisible`, lọc theo `isExecutionAllowed`.
  - Phân trang server-side (`page`, `pageSize`, mặc định 20, tối đa 100), sắp xếp theo tên hoặc thời điểm cập nhật.
- API `GET /api/admin/node-types/:key`:
  - Trả về thông tin chi tiết node type, `configSchema`, `inputSchema`, `outputSchema`, và danh sách top workflows đang sử dụng (chỉ gồm `id`, `name`, `ownerEmail`, `status`).

### FR-NM-02: Phân tách Cấp độ Kiểm soát (Catalog Visibility vs Execution Availability)
Hệ thống hỗ trợ 2 cờ độc lập do Admin cấu hình:
1. **Hiển thị trên Palette (`isCatalogVisible`)** (mặc định `true`):
   - Khi `isCatalogVisible = false`: Node type bị ẩn khỏi endpoint `GET /api/node-types` gửi về cho Designer canvas của Client.
   - Người dùng không thể kéo thả thêm node này vào canvas khi tạo hoặc sửa workflow.
   - **Tính tương thích ngược**: Các workflow cũ (cả draft và published) có chứa node này **vẫn mở được, lưu được và chạy bình thường**.
2. **Cho phép Thực thi Runtime (`isExecutionAllowed`)** (mặc định `true`):
   - Khi Admin phát hiện sự cố khẩn cấp (ví dụ lỗ hổng bảo mật hoặc API đối tác bị đóng vĩnh viễn), Admin có thể đặt `isExecutionAllowed = false`.
   - **Xử lý Runtime an toàn**: Khi workflow engine thực thi đến node này, `NodeRunner` sẽ chặn gọi executor, ghi nhận bản ghi `ExecutionNodeLog` với trạng thái `FAILED`, mã lỗi chuẩn hóa `NODE_TYPE_DISABLED`, và kết thúc an toàn mà không làm sập tiến trình engine.

### FR-NM-03: Độc lập với Quá trình Đồng bộ Catalog (`PackageCatalogSync`)
- Trạng thái chính sách của Admin được lưu trữ trong bảng riêng `node_type_policies`.
- Tiến trình khởi động server (`PackageCatalogSync`) chỉ cập nhật metadata (`displayName`, `icon`, schemas) vào bảng `node_type_definitions`, tuyệt đối không ghi đè các cờ `isCatalogVisible` hay `isExecutionAllowed` trong `node_type_policies`.

### FR-NM-04: Thao tác Thay đổi Trạng thái và Kiểm toán (Audit)
- API `PATCH /api/admin/node-types/:key/status`:
  - Request body: `{ isCatalogVisible?: boolean, isExecutionAllowed?: boolean, reason: string, expectedRevision: number }`.
  - Bắt buộc nhập lý do (`reason`) từ 5 đến 500 ký tự.
  - Kiểm tra `expectedRevision`: Nếu bản ghi đã bị sửa đổi trước đó, trả về HTTP `409 Conflict` (`STALE_REVISION`).
  - Xử lý No-op: Nếu request gửi cùng giá trị hiện tại, trả về thành công nhưng không tăng revision và không tạo audit event giả.
  - Ghi nhận sự kiện kiểm toán `NODE_TYPE_STATUS_CHANGED` vào `admin_audit_events` cùng transaction với cập nhật trạng thái.

## 3. Tiêu chí Nghiệm thu (Acceptance Criteria)
- **AC-NM-01**: Admin tra cứu danh mục Node Types hiển thị đúng `publishedWorkflowCount` và `draftWorkflowCount`.
- **AC-NM-02**: Khi `isCatalogVisible = false`, node bị ẩn khỏi palette Designer nhưng workflow cũ chứa node vẫn tải và chạy bình thường.
- **AC-NM-03**: Khi `isExecutionAllowed = false`, workflow chạy đến node này sẽ dừng lại an toàn với mã lỗi `NODE_TYPE_DISABLED`.
- **AC-NM-04**: Khởi động lại server và chạy `PackageCatalogSync` bảo toàn 100% các cờ chính sách do Admin đã thiết lập.
- **AC-NM-05**: Mọi thay đổi trạng thái node type đều ghi nhận sự kiện `NODE_TYPE_STATUS_CHANGED` atomic trong transaction.
