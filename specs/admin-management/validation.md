# Nghiệm thu và Kế hoạch Kiểm thử Admin (Validation & Test Plan)

Status: ready-for-agent

Tài liệu này bao gồm:
1. **Kết quả nghiệm thu thực tế giai đoạn P0** (G0–G3): Đã hoàn thành ngày 2026-11-14 theo PR #39.
2. **Kế hoạch và kịch bản kiểm thử chi tiết giai đoạn P1** (G4–G8): Sẵn sàng thực hiện khi bắt đầu triển khai mã nguồn.

---

## 1. Kết quả Nghiệm thu Thực tế Giai đoạn P0 (PR #39 - 2026-11-14)

### 1.1. Bảng tổng hợp kết quả chạy thực tế

| Bộ kiểm tra | Lệnh thực thi | Kết quả thực tế | Ghi chú |
| --- | --- | --- | --- |
| Backend Unit Test Suite | `npm test -- --runInBand` | **37 suites passed, 538 tests passed** | Toàn bộ unit tests domain, application, CQRS handlers |
| Backend Integration Suite | `npm run test:integration` | **19 tests passed** | Kiểm tra với PostgreSQL và Redis thật trên database test riêng biệt |
| Backend ESLint | `npm run lint` | **303 files; 0 errors, 0 warnings** | Chạy với Node heap 4 GB theo tiêu chuẩn của repo |
| Backend Nest Build | `npm run build` | **Thành công (webpack compiled)** | Build production sạch |
| Backend TypeScript Build | `tsc --noEmit -p tsconfig.build.json` | **Thành công** | Type check production đạt chuẩn |
| Frontend Unit Test Suite | `npm test` | **44 files, 150 tests passed** | Kiểm thử Vitest + React Testing Library |
| Frontend Account Detail Tests | `npm test -- UserDetailPage` | **4 tests passed** | Kiểm tra render metadata, workflow summary, dialogs |
| Frontend Build & Lint | `npm run build` | **Thành công (Vite build 4.36s)** | TypeScript, ESLint và rollup bundle production |
| Database Migration Local | `prisma migrate deploy` | **Áp dụng thành công `20261114000000_admin_p0`** | Chuyển đổi 2 role cũ sang `CLIENT`, bảo toàn toàn bộ dữ liệu |

### 1.2. Các hành vi đã được kiểm chứng ở P0
- **Phân quyền & Đăng ký**: Unauthenticated gọi API Admin trả `401`; Client gọi API Admin trả `403`. Public registration từ chối field `role`. Role cũ `DEVELOPER`/`BUSINESS_USER` được chuyển thành `CLIENT`, `ADMIN` giữ nguyên. Bootstrap Admin đầu tiên qua CLI hoạt động và ghi SYSTEM audit.
- **Quản lý Tài khoản**: Tra cứu, lọc, phân trang chỉ metadata; không rò rỉ token hay password. Khóa tài khoản vô hiệu hóa token cũ tức thì thông qua `session_version` và Redis outbox; mở khóa không làm token cũ sống lại.
- **Bảo vệ Invariant**: Admin không thể tự khóa hoặc tự đổi role của chính mình. Luôn bảo đảm còn ít nhất 1 Admin active khi 2 Admin thao tác đồng thời. Request từ revision cũ bị từ chối với `409 Stale Revision`.
- **Tác động Runtime**: Khóa owner làm dừng enqueue webhook mới (vẫn trả HTTP ACK); worker claim job queued của owner bị khóa sẽ chuyển trạng thái `CANCELLED` với lý do `OWNER_SUSPENDED`, không gọi executor. Lượt đã `RUNNING` được phép hoàn tất.
- **Dashboard**: Aggregate PostgreSQL trong transaction Repeatable Read, tỷ lệ thành công 75% cho tập mẫu chuẩn, nhóm lỗi an toàn (`errorCode`), không lộ raw error message, bộ lọc thời gian và polling dừng khi tab ẩn.

---

## 2. Kế hoạch và Kịch bản Kiểm thử Chi tiết Giai đoạn P1 (G4–G8)

### 2.1. Ma trận Kịch bản Kiểm thử theo Acceptance Criteria

| Mã AC | Giai đoạn | Tên kịch bản | Môi trường kiểm thử | Kỳ vọng bắt buộc |
| --- | --- | --- | --- | --- |
| **AC-10** | G4 | Race condition giữa OAuth flow và khóa policy | Integration (HTTP + Fake OAuth Provider + DB) | Bấm connect OAuth -> Admin khóa policy -> OAuth callback hoàn tất -> Callback bị từ chối `409 CONNECTOR_NEW_CREDENTIALS_DISABLED` |
| **AC-11** | G4 | Tính bền vững qua server restart & package sync | Integration (Service restart simulation) | Đổi policy connector -> Chạy `PackageCatalogSync.sync()` -> Row trong `connector_policies` giữ nguyên giá trị |
| **AC-18** | G4 | Projection danh mục connector và thống kê | Integration (HTTP + DB Fixture) | `GET /api/admin/connectors` trả về đúng `credentialCount` và `workflowCount` (distinct published workflows) |
| **AC-19** | G4 | Chặn tạo API Key credential khi cấm tạo mới | Integration (HTTP + DB) | Đặt `allowNewCredentials = false` -> `POST /api/connectors/:id/credentials` trả `409` kèm mã lỗi chuẩn |
| **AC-20** | G5 | Danh mục Node Type và thống kê workflow sử dụng | Integration (HTTP + DB Fixture) | `GET /api/admin/node-types` trả về đúng `publishedWorkflowCount` và `draftWorkflowCount` |
| **AC-21** | G5 | Ẩn node khỏi catalog Designer (`isCatalogVisible=false`) | Integration (Designer API + Runtime) | `GET /api/node-types` không chứa node bị ẩn; workflow cũ chứa node này vẫn load và execute bình thường |
| **AC-22** | G5 | Cấm thực thi node ở runtime (`isExecutionAllowed=false`) | Integration (Workflow Engine + Worker) | Workflow chạy đến node này dừng lại; node log ghi `FAILED` với `errorCode: NODE_TYPE_DISABLED` |
| **AC-23** | G5 | Tính bền vững của Node Type Policy qua restart | Integration (Package sync simulation) | Đổi cờ `isCatalogVisible`/`isExecutionAllowed` -> Chạy `PackageCatalogSync` -> Policy không bị ghi đè |
| **AC-24** | G6 | Lọc danh sách execution đa chiều | Integration (HTTP + DB Fixture) | Lọc theo owner, workflow, execution ID, status, trigger, time range trả về đúng tập dữ liệu, phân trang đúng |
| **AC-25** | G6 | Kiểm tra rò rỉ dữ liệu nhạy cảm trong execution | Security / Integration (HTTP + DB) | Dữ liệu giả lập chứa email, secret, prompt, raw error stack -> Response của Admin API hoàn toàn không chứa các chuỗi này |
| **AC-26** | G6 | Đảm bảo tính chỉ đọc (Read-only) của Execution UI | Frontend Unit / Component (Vitest) | `ExecutionsPage` và `ExecutionDetailPage` không render bất kỳ nút Run, Retry, Cancel hay link edit canvas |
| **AC-27** | G7 | Tra cứu Audit Logs và xem diff Before/After | Integration & Frontend (HTTP + Vitest) | `GET /api/admin/audit-events` lọc đa chiều; xem chi tiết trả về diff Before vs After đúng các trường whitelist |
| **AC-28** | G7 | Tính bất biến và toàn vẹn của Audit Log | Integration (DB Transaction Test) | Bảng audit không có API sửa/xóa; nếu cố ý làm lỗi audit insert, toàn bộ mutation nghiệp vụ phải rollback |

---

### 2.2. Chi tiết Kịch bản Kiểm thử Chuyên biệt

#### 2.2.1. Kịch bản Kiểm thử Race Condition OAuth (AC-10 - G4)
- **Mục đích**: Đảm bảo không người dùng nào tạo được credential mới sau khi Admin đã tắt chính sách, ngay cả khi người dùng đã mở trang xác thực của Google trước đó.
- **Các bước thực hiện**:
  1. User A gọi `GET /api/integrations/google/auth` khi `allowNewCredentials = true`. Nhận về auth URL và state hợp lệ.
  2. Admin gọi `PATCH /api/admin/connectors/:id/credential-policy` với `allowNewCredentials: false`. Giao dịch commit thành công.
  3. User A hoàn tất xác thực trên Google và Google redirect về `GET /api/integrations/google/callback?code=...&state=...`.
- **Kỳ vọng**:
  - Callback handler mở transaction, kiểm tra lại policy và phát hiện `allowNewCredentials === false`.
  - Transaction bị rollback. Không có dòng mới nào trong `connector_credentials`.
  - User nhận thông báo lỗi `CONNECTOR_NEW_CREDENTIALS_DISABLED`.

#### 2.2.2. Kịch bản Kiểm thử Tương thích Ngược khi Ẩn / Chặn Node Type (AC-21 & AC-22 - G5)
- **Mục đích**: Xác minh tính độc lập giữa hiển thị catalog và khả năng thực thi của các workflow cũ.
- **Kịch bản A (Chỉ ẩn khỏi palette)**:
  1. Tạo workflow W1 chứa node `integration.slack.postMessage`. Publish W1.
  2. Admin đổi trạng thái node `integration.slack.postMessage`: `isCatalogVisible: false`, `isExecutionAllowed: true`.
  3. Client mở Designer tạo workflow mới -> Palette không có node Slack.
  4. Client kích hoạt W1 -> Workflow W1 chạy thành công, node Slack gửi tin nhắn bình thường.
- **Kịch bản B (Chặn thực thi runtime)**:
  1. Admin đổi trạng thái node: `isExecutionAllowed: false`.
  2. Client kích hoạt W1.
  3. Engine xử lý tới node Slack -> `NodeRunner` bắt chặn, không gọi executor.
  4. `ExecutionNodeLog` ghi trạng thái `FAILED`, `errorCode: NODE_TYPE_DISABLED`.
  5. Workflow W1 kết thúc `FAILED` an toàn, không có unhandled crash error.

#### 2.2.3. Kịch bản Kiểm thử Bảo mật & Riêng tư Dữ liệu Execution (AC-25 - G6)
- **Mục đích**: Chứng minh bằng kiểm thử tự động rằng Admin không thể đọc lén dữ liệu Client qua API Giám sát Execution.
- **Dữ liệu kiểm thử (Fixture)**:
  - Tạo Execution E1 với `context = { "OPENAI_API_KEY": "sk-secret-token-12345", "userEmail": "customer@confidential.com" }`.
  - Node log N1 có `input = { "prompt": "Write a confidential financial report" }`.
  - Node log N1 có `output = { "result": "Company revenue is $10M" }`.
  - Node log N1 có `errorMessage = "Error connecting to db: postgres://admin:pass123@internal:5432"`.
  - Node log N1 có `errorStack = "Error: Connection failed\n at Client.connect (/app/secret-path.ts:42)"`.
- **Thực thi**:
  - Admin gọi `GET /api/admin/executions` và `GET /api/admin/executions/E1`.
- **Kỳ vọng**:
  - Chuỗi JSON trả về được quét tự động bằng assert:
    - `expect(responseBody).not.toContain('sk-secret-token-12345')`
    - `expect(responseBody).not.toContain('customer@confidential.com')`
    - `expect(responseBody).not.toContain('confidential financial report')`
    - `expect(responseBody).not.toContain('$10M')`
    - `expect(responseBody).not.toContain('pass123')`
    - `expect(responseBody).not.toContain('secret-path.ts')`
  - Các trường trả về chỉ gồm: `id`, `workflowId`, `status`, `queuedAt`, `durationMs`, mã lỗi chuẩn hóa `errorCode: 'DATABASE_CONNECTION_ERROR'`, v.v.

#### 2.2.4. Kịch bản Kiểm thử Kiểm toán Toàn vẹn (AC-09 & AC-28 - G7)
- **Mục đích**: Đảm bảo tính toàn vẹn của audit event và khả năng rollback hoàn toàn khi ghi audit lỗi.
- **Các bước thực hiện**:
  1. Mock repository audit cố ý ném lỗi database exception khi lưu bản ghi audit.
  2. Gọi `PATCH /api/admin/connectors/:id/credential-policy`.
- **Kỳ vọng**:
  - API trả về lỗi `500 Internal Server Error`.
  - Database rollback hoàn toàn: Cờ `allowNewCredentials` trong `connector_policies` không bị thay đổi; `revision` không tăng.

---

## 3. Quy chuẩn Kiểm thử Frontend (Vitest & React Testing Library)

- Kiểm thử tương tác component theo hành vi người dùng (`screen.getByRole`, `userEvent.click`), không kiểm thử dựa trên snapshot DOM cấu trúc.
- Mọi dialog mutation (`ConnectorPolicyDialog`, `NodeTypeStatusDialog`) phải kiểm thử:
  1. Nút Submit bị disable khi chưa nhập lý do hợp lệ (dưới 5 ký tự).
  2. Hiển thị cảnh báo tóm tắt trước/sau.
  3. Xử lý lỗi `409 Conflict` (hiển thị thông báo revision xung đột và gọi tải lại dữ liệu).
- Kiểm thử cơ chế visible-only polling trên `ExecutionsPage`:
  - Mô phỏng `document.visibilityState = 'hidden'` -> Xác minh không có request polling ngầm nào được gửi.
  - Mô phỏng `document.visibilityState = 'visible'` -> Xác minh polling tự động kích hoạt lại.
