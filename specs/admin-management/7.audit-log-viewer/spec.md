# Spec: Trình tra cứu Nhật ký Quản trị (Audit Log Viewer)

Status: implemented (P1, 2026-11-24)

## 1. Mục tiêu và Bối cảnh
Cung cấp màn hình tra cứu lịch sử kiểm toán toàn diện và minh bạch cho Quản trị viên, theo dõi toàn bộ các tác động quản trị trên hệ thống, xem đối chiếu chi tiết thay đổi (Diff Before vs After) trên các trường dữ liệu an toàn.

Nguồn yêu cầu: [SRS](../../../docs/srs.md) (FR-AD-11, FR-AU-07), [PRD](../../../docs/prd.md).

## 2. Yêu cầu Chức năng (Functional Requirements)

### FR-AL-01: Phạm vi Ghi nhận Kiểm toán (Audit Logging Scope)
Mọi thao tác quản trị có hiệu lực làm thay đổi dữ liệu phải được ghi nhận vào `admin_audit_events` cùng database transaction với mutation nghiệp vụ:
1. `USER_SUSPENDED`: Khóa tài khoản người dùng (G2 - Đã có).
2. `USER_REACTIVATED`: Mở khóa tài khoản người dùng (G2 - Đã có).
3. `USER_ROLE_CHANGED`: Đổi vai trò Client ↔ Admin (G2 - Đã có).
4. `ADMIN_BOOTSTRAPPED`: Khởi tạo Admin đầu tiên qua lệnh CLI nội bộ (G1 - Đã có).
5. `CONNECTOR_POLICY_CHANGED`: Thay đổi chính sách `allowNewCredentials` của connector (G4 - Đã có).
6. `NODE_TYPE_STATUS_CHANGED`: Thay đổi trạng thái `isCatalogVisible` hoặc `isExecutionAllowed` của node type (G5 - Đã có).

### FR-AL-02: Cấu trúc Bản ghi và Whitelist Trước/Sau (Before/After)
- Bản ghi audit gồm: `id` (UUID), `actorType` (`ADMIN`, `SYSTEM`), `actorId` (UUID hoặc null), `action` (tên hành động), `targetType` (`USER`, `CONNECTOR`, `NODE_TYPE`), `targetId` (UUID; node type dùng definition.id), `reason` (chuỗi lý do bắt buộc từ 5 đến 500 ký tự), `before` (JSON), `after` (JSON), `createdAt` (UTC timestamp).
- **Nguyên tắc Whitelist Before/After**:
  - Tuyệt đối không chụp toàn bộ object (snapshot dump).
  - Chỉ lưu các trường trạng thái liên quan:
    - User mutations: `{ isActive, role, revision? }`; revision chỉ hiển thị nếu event đã ghi, không suy đoán từ tài nguyên hiện tại.
    - Connector policy mutations: `{ allowNewCredentials, revision }`.
    - Node type status mutations: `{ isCatalogVisible, isExecutionAllowed, revision }`.
    - Bootstrap: `{ role: 'ADMIN', isActive: true }`.

### FR-AL-03: Danh sách và Bộ lọc Nhật ký Quản trị
- API `GET /api/admin/audit-events`:
  - **Bộ lọc**:
    - `actorId`: Lọc theo ID quản trị viên thực hiện.
    - `actorType`: Lọc theo `ADMIN` hoặc `SYSTEM`.
    - `action`: Lọc theo tên hành động cụ thể.
    - `targetType`: Lọc theo loại tài nguyên (`USER`, `CONNECTOR`, `NODE_TYPE`).
    - `targetId`: Lọc theo ID tài nguyên mục tiêu.
    - `from` và `to`: Khoảng thời gian nửa mở `[from, to)` (tối đa 90 ngày).
  - Phân trang server-side (`page`, `pageSize`, mặc định 20, tối đa 100), sắp xếp giảm dần theo thời gian tạo (`createdAt desc`, `id desc`).
  - Response danh sách bao gồm thông tin tóm tắt kèm tên/email của actor (nếu có).

### FR-AL-04: Chi tiết Sự kiện và Đối chiếu Thay đổi (Diff Viewer)
- API `GET /api/admin/audit-events/:id`:
  - Trả về thông tin chi tiết sự kiện kiểm toán: Mã sự kiện, người thực hiện (tên, email), hành động, tài nguyên mục tiêu (loại, ID, tên nếu join được), thời điểm chính xác (UTC và local), lý do Admin đã nhập.
  - Khối dữ liệu Before và After được hiển thị đối chiếu trực quan (Diff Viewer): Nổi bật các trường bị thay đổi (ví dụ: `isActive: true` -> `isActive: false`).

### FR-AL-05: Tính Bất biến và Toàn vẹn (Immutability & Atomic Writes)
- Bảng `admin_audit_events` hoàn toàn chỉ đọc: Backend tuyệt đối không cung cấp bất kỳ API nào để cập nhật (`PUT`/`PATCH`) hay xóa (`DELETE`) bản ghi audit.
- Ghi nhận atomic: Nếu việc ghi bản ghi audit vào cơ sở dữ liệu gặp lỗi, toàn bộ transaction của mutation đó bắt buộc phải bị rollback; hệ thống không bao giờ ghi nhận thay đổi thành công mà thiếu bản ghi audit tương ứng.
- Các thao tác no-op hoặc request bị từ chối do phân quyền / sai revision không được phát sinh bản ghi audit.

## 3. Tiêu chí Nghiệm thu (Acceptance Criteria)
- **AC-AL-01**: Admin tra cứu danh sách audit events lọc theo actor, action, target và thời gian chính xác; phân trang đúng.
- **AC-AL-02**: Xem chi tiết audit event hiển thị đầy đủ thông tin actor, target, lý do và diff Before/After theo đúng whitelist.
- **AC-AL-03**: Bảng audit events bất biến 100%; không có bất kỳ endpoint chỉnh sửa hoặc xóa nào.
- **AC-AL-04**: Ghi audit thất bại làm rollback toàn bộ transaction mutation tương ứng.
- **AC-AL-05**: Toàn bộ các thao tác thay đổi ở G1, G2, G4, G5 đều phát sinh bản ghi audit tương ứng với action chuẩn hóa.

## 4. Quyết định triển khai và seams

User xác nhận triển khai ngày 2026-11-24 sau [phân tích G7](analysis.md).

- Bộ lọc kết hợp AND. targetId và actorId là UUID; action/actorType/targetType filter dùng enum được hỗ trợ. Detail UUID lookup không bị range list giới hạn.
- Thiếu to dùng now, thiếu from dùng to trừ 7 ngày; [from,to) theo createdAt, max 90 ngày; timestamp phải có timezone. Reject pagination không hợp lệ hoặc offset vượt signed 32-bit.
- List chỉ trả metadata; detail trả thêm before/after được projection theo action/target whitelist. Snapshot chấp nhận scalar đúng kiểu, giữ null đã ghi và loại trường lạ/sai kiểu; node snapshot key không nằm trong diff whitelist.
- Record action/actorType/targetType chưa nhận diện hiển thị UNKNOWN_ACTION/UNKNOWN, snapshot rỗng; không trả raw JSON không được hỗ trợ.
- User audit cũ thiếu revision vẫn đọc được. Bootstrap CLI có before trạng thái account cũ; development seed có before {}. Không backfill hoặc sửa lịch sử.
- Tên/email actor và tên target là metadata hiện tại; batch lookup có null fallback giữ mọi event, gồm SYSTEM/actorId null hoặc resource đã thiếu. Không đọc credentials/definition.
- Diff hiển thị các trường trong whitelist của action, gồm revision tùy chọn để thể hiện dữ liệu lịch sử chưa ghi; missing = “Không ghi nhận”, null = “null”, false/0 giữ nguyên; highlight theo thay đổi giá trị. Không render raw HTML/JSON.
- Filters/page/event dialog lưu trong URL. Đổi filter reset page 1; đóng dialog giữ filter/page. List polling 30 giây chỉ visible; detail tải khi mở, không polling, refresh khi mở lại; cleanup và AbortSignal đến HTTP client.
- Bất biến nghiệm thu ở API: không có POST/PUT/PATCH/DELETE audit endpoints. Database chưa chống direct UPDATE/DELETE bằng quyền/trigger; không bổ sung cơ chế đó vào G7 viewer.
- Public seams: Admin HTTP với JWT/role và isolated PostgreSQL; writer rollback connector tại HTTP/database; UI list/dialog và hook tại HTTP/browser boundary.

## 5. BDD Given/When/Then và traceability

| ID | Given | When | Then | AC / test layer |
| --- | --- | --- | --- | --- |
| BDD-AL-01 | Events nhiều actor/action/target | Kết hợp filters/phân trang | Chỉ events khớp, total đúng, createdAt desc/id desc | AC-AL-01; PostgreSQL/HTTP |
| BDD-AL-02 | Events ở from/to và cùng createdAt | Tra cứu [from,to) | Gồm from, loại to, tie-break id | AC-AL-01; PostgreSQL/HTTP |
| BDD-AL-03 | UUID/enum/page/range sai | Gọi APIs | 400 trước query; default 7 ngày, page 1/pageSize 20 | AC-AL-01; HTTP |
| BDD-AL-04 | SYSTEM/null actor hoặc metadata không tồn tại | Đọc event | Event giữ nguyên, tên nullable/fallback rõ ràng | AC-AL-02; HTTP/UI |
| BDD-AL-05 | Snapshot cũ thiếu revision, có false/0/null và field lạ | Đọc detail/diff | Whitelist, missing khác null/false/0; không lộ sentinel | AC-AL-02; HTTP/UI |
| BDD-AL-06 | Field đổi/giữ nguyên/thêm/xóa | Xem diff | Highlight chỉ field thay đổi; không suy đoán giá trị cũ | AC-AL-02; UI |
| BDD-AL-07 | Client/chưa login/role hoặc session bị thu hồi | Đọc APIs; thử sửa/xóa event | Read bị từ chối đúng quyền; không có mutation endpoints | AC-AL-03; HTTP/JWT |
| BDD-AL-08 | Connector audit insert lỗi | Gửi policy change | Policy/revision và audit rollback toàn bộ | AC-AL-04; PostgreSQL/HTTP; account/node tests hiện có |
| BDD-AL-09 | Sáu loại action hợp lệ | Mutation và tra cứu | Action chuẩn, metadata/snapshot đúng; bootstrap hỗ trợ hai dạng | AC-AL-05; writer regression + reader HTTP |
| BDD-AL-10 | No-op, stale revision, không quyền | Gửi mutation | Không thêm audit event | FR-AL-05; integration |
| BDD-AL-11 | List rỗng, detail không tồn tại hoặc HTTP lỗi | Xem/tải lại | Empty/404/error rõ ràng, tải lại chỉ GET | AC-AL-01/02/03; UI |
| BDD-AL-12 | Visible → hidden → visible, dialog mở/đóng, unmount | Tiến clock/browser lifecycle | List poll 30 giây chỉ visible; detail fetch-on-open; cleanup | AC-AL-01/02; hook/browser |
