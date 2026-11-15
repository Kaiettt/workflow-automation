# Spec: Quản lý Connector và Chính sách Credential (Connector Management)

Status: ready-for-agent (P1)

## 1. Mục tiêu và Bối cảnh
Cung cấp khả năng quản lý danh mục kết nối dịch vụ bên thứ ba (Connectors), xem thống kê mức độ sử dụng và điều phối chính sách tạo credential mới (`allowNewCredentials`) cho Quản trị viên, bảo toàn toàn vẹn các kết nối và workflow hiện hữu của người dùng.

Nguồn yêu cầu: [SRS](../../../docs/srs.md) (FR-CF-07, FR-AD-08, FR-AD-09), [PRD](../../../docs/prd.md).

## 2. Yêu cầu Chức năng (Functional Requirements)

### FR-CM-01: Danh mục và Thống kê Sử dụng Connector
- API `GET /api/admin/connectors`:
  - Trả về danh sách toàn bộ Connector trong hệ thống với các trường: `id`, `key`, `name`, `authType` (`NONE`, `API_KEY`, `OAUTH2`, `BASIC`), `isActive` (trạng thái catalog kỹ thuật), `allowNewCredentials` (chính sách tiếp nhận kết nối mới), `revision`, `credentialCount`, `workflowCount`, `createdAt`, `updatedAt`.
  - `credentialCount`: Tổng số credential hiện đang lưu trữ của connector này trên toàn hệ thống.
  - `workflowCount`: Số lượng workflow phân biệt (`distinct published workflows`) đang tham chiếu đến connector này trong phiên bản đã xuất bản hiện tại (`PUBLISHED`).
  - Hỗ trợ tìm kiếm theo tên hoặc key (`q`), lọc theo `authType`, lọc theo `isActive`, lọc theo `allowNewCredentials`.
  - Phân trang server-side (`page`, `pageSize`, mặc định 20, tối đa 100), sắp xếp giảm dần `createdAt`.
  - Tuyệt đối không trả về thông tin mật, access token, refresh token hay API key của người dùng.
- API `GET /api/admin/connectors/:id`:
  - Trả về thông tin chi tiết connector, danh sách các loại node (`nodeTypes`) trực thuộc, thống kê số lượng và trạng thái chính sách hiện tại.

### FR-CM-02: Phân tách `Connector.isActive` và `allowNewCredentials`
- **`Connector.isActive`**: Thể hiện connector có mã nguồn/package hoạt động trong hệ thống hay không (do code & catalog sync quyết định).
- **`allowNewCredentials`** (mặc định `true`): Cờ chính sách do Admin kiểm soát.
  - Khi `allowNewCredentials = false`: Tạm dừng cấp mới credential cho connector này.
  - **Bảo toàn dữ liệu cũ**: Mọi credential đã tạo từ trước **vẫn tiếp tục hoạt động bình thường 100%**. Người dùng vẫn có thể chọn credential này trong workflow, workflow đang chạy vẫn gọi API bình thường, và các tiến trình refresh token định kỳ vẫn hoạt động bình thường.
  - Thao tác của Admin không làm thay đổi `Connector.isActive`, không thay đổi config schema, và không xóa/sửa bất kỳ bản ghi `ConnectorCredential` nào.

### FR-CM-03: Kiểm soát Toàn diện các Luồng Tạo Credential
Chính sách `allowNewCredentials` phải được áp dụng đồng bộ ở mọi luồng tạo credential:
1. **API Key / Form Credential**: `CreateApiKeyCredentialCommand` kiểm tra cờ; nếu `false`, từ chối với HTTP `409 Conflict`, mã lỗi `CONNECTOR_NEW_CREDENTIALS_DISABLED`.
2. **Google OAuth**: Chặn ngay từ bước lấy URL ủy quyền (`GetGoogleAuthUrlQuery`) và kiểm tra lại bắt buộc tại callback hoàn tất (`HandleGoogleCallbackCommand`).
3. **Package OAuth2**: Chặn tại bước khởi tạo auth URL (`OAuth2Controller.auth`) và kiểm tra lại bắt buộc tại bước hoàn tất lưu token (`OAuth2Service.complete`).

### FR-CM-04: Xử lý Race Condition tại OAuth Callback
- Nếu người dùng bấm "Connect Google" khi chính sách đang bật, nhưng Admin tắt chính sách trong lúc người dùng đang thao tác trên Google consent screen:
  - Khi Google redirect về callback: Backend mở transaction, lấy lock trên bảng `connector_policies` và kiểm tra lại giá trị `allowNewCredentials`.
  - Nếu đã bị tắt (`false`), callback transaction lập tức rollback, hủy lưu trữ credential và trả về trang thông báo lỗi cho popup `CONNECTOR_NEW_CREDENTIALS_DISABLED`.

### FR-CM-05: Độc lập với Quá trình Đồng bộ Catalog (`PackageCatalogSync`)
- Cấu hình chính sách quản trị được lưu trữ trong bảng riêng `connector_policies`.
- Tiến trình khởi động server (`PackageCatalogSync` và database seed) chỉ thực hiện upsert danh mục kỹ thuật vào bảng `connectors`, tuyệt đối không ghi đè giá trị `allowNewCredentials` hay `revision` trong `connector_policies`.

### FR-CM-06: Thao tác Thay đổi Chính sách và Kiểm toán (Audit)
- API `PATCH /api/admin/connectors/:id/credential-policy`:
  - Request body: `{ allowNewCredentials: boolean, reason: string, expectedRevision: number }`.
  - Bắt buộc nhập lý do (`reason`) từ 5 đến 500 ký tự.
  - Kiểm tra `expectedRevision`: Nếu bản ghi đã bị sửa đổi trước đó, trả về HTTP `409 Conflict` (`STALE_REVISION`).
  - Xử lý No-op: Nếu request gửi cùng giá trị hiện tại, trả về thành công nhưng không tăng revision và không tạo audit event giả.
  - Ghi nhận sự kiện kiểm toán `CONNECTOR_POLICY_CHANGED` vào `admin_audit_events` cùng transaction với cập nhật chính sách.

## 3. Tiêu chí Nghiệm thu (Acceptance Criteria)
- **AC-CM-01**: Admin tra cứu danh mục Connector hiển thị đúng `credentialCount` và `workflowCount`.
- **AC-CM-02**: Tắt `allowNewCredentials` làm mọi yêu cầu tạo mới API Key / OAuth credential bị từ chối với `409 CONNECTOR_NEW_CREDENTIALS_DISABLED`.
- **AC-CM-03**: Khi `allowNewCredentials = false`, toàn bộ credential cũ vẫn được đọc, chọn trong workflow, thực thi và tự động refresh token bình thường.
- **AC-CM-04**: Race condition: Admin tắt policy trong lúc OAuth đang diễn ra -> Callback hoàn tất bị từ chối an toàn, không có credential rác nào được lưu.
- **AC-CM-05**: Khởi động lại server hoặc chạy `PackageCatalogSync` bảo toàn 100% giá trị chính sách do Admin đã thiết lập.
- **AC-CM-06**: Mọi thay đổi chính sách connector đều ghi nhận sự kiện `CONNECTOR_POLICY_CHANGED` atomic trong transaction.
