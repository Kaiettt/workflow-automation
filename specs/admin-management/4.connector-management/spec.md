# Spec: Quản lý Connector và Chính sách Credential (Connector Management)

Status: ready-for-agent (P1)

## 1. Mục tiêu và Bối cảnh (Context & User Stories)

Cung cấp khả năng quản lý danh mục kết nối dịch vụ bên thứ ba (Connectors), xem thống kê mức độ sử dụng và điều phối chính sách tạo credential mới (`allowNewCredentials`) cho Quản trị viên, bảo toàn toàn vẹn các kết nối và workflow hiện hữu của người dùng.

Nguồn yêu cầu: [SRS](../../../docs/srs.md) (FR-CF-07, FR-AD-08, FR-AD-09), [PRD](../../../docs/prd.md).

### 1.1. User Stories

- **US-CM-01 (Quản trị viên)**: Là một Quản trị viên (Admin), tôi muốn xem danh sách các Connector trong hệ thống kèm số lượng credentials và workflows đang dùng, để tôi đánh giá mức độ phụ thuộc và rủi ro của từng dịch vụ tích hợp.
- **US-CM-02 (Quản trị viên)**: Là một Quản trị viên, tôi muốn tạm dừng việc cấp mới credentials (`allowNewCredentials = false`) cho một Connector khi dịch vụ đó gặp sự cố bảo mật hoặc cần bảo trì, kèm theo lý do cụ thể và kiểm soát xung đột phiên bản (optimistic concurrency).
- **US-CM-03 (Người dùng cuối / Workflow Creator)**: Là một người dùng, khi một Connector bị tạm ngưng cấp credential mới, các workflow đã cấu hình trước đó của tôi vẫn phải tiếp tục thực thi và tự động làm mới token bình thường mà không bị gián đoạn.
- **US-CM-04 (Hệ thống)**: Là hệ sinh thái nền tảng, khi server khởi động lại hoặc tiến trình đồng bộ package (`PackageCatalogSync`) chạy, các chính sách bảo mật do Admin thiết lập không bao giờ bị ghi đè hay mất hiệu lực.

---

## 2. Yêu cầu Chức năng (Functional Requirements)

### FR-CM-01: Danh mục và Thống kê Sử dụng Connector
- API `GET /api/admin/connectors`:
  - Trả về danh sách Connector với các trường: `id`, `key`, `name`, `authType` (`NONE`, `API_KEY`, `OAUTH2`, `BASIC`), `isActive`, `allowNewCredentials`, `revision`, `credentialCount`, `workflowCount`, `createdAt`, `updatedAt`.
  - `credentialCount`: Tổng số credential hiện lưu trữ của connector này trên toàn hệ thống.
  - `workflowCount`: Số lượng workflow phân biệt (`distinct published workflows`) đang tham chiếu đến connector này trong phiên bản đã xuất bản hiện tại (`status = 'PUBLISHED'`).
  - Tìm kiếm theo tên hoặc key (`q`), lọc theo `authType`, `isActive`, `allowNewCredentials`.
  - Phân trang server-side (`page`, `pageSize`, mặc định 20, tối đa 100), sắp xếp giảm dần theo `createdAt`.
  - Tuyệt đối không trả về thông tin mật, access token, refresh token hay API key.
- API `GET /api/admin/connectors/:id`:
  - Trả về chi tiết connector, danh sách các node types trực thuộc, thống kê số lượng và chính sách hiện tại.

### FR-CM-02: Phân tách `Connector.isActive` và `allowNewCredentials`
- **`Connector.isActive`**: Trạng thái package/code trong catalog (do code và catalog sync quyết định).
- **`allowNewCredentials`** (mặc định `true`): Cờ chính sách do Admin kiểm soát trong bảng `connector_policies`.
  - Khi `allowNewCredentials = false`: Tạm dừng cấp mới credential cho connector này.
  - **Bảo toàn dữ liệu cũ**: Mọi credential đã tạo từ trước **vẫn tiếp tục hoạt động 100%**. Người dùng vẫn có thể chọn credential này trong workflow, workflow đang chạy vẫn gọi API bình thường, và các tiến trình refresh token định kỳ vẫn hoạt động bình thường.
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

---

## 3. Tiêu chí Nghiệm thu theo BDD (Behavior-Driven Development Scenarios)

### Feature: Quản lý Connector và Chính sách Cấp mới Credential

```gherkin
Feature: Connector Management and Credential Policy Enforcement
  As an Administrator
  I want to monitor connector usage and enforce credential issuance policies
  So that I can mitigate integration security risks while protecting active user workflows
```

#### BDD-CM-01: Tra cứu danh mục và thống kê Connector (AC-CM-01)
```gherkin
  Scenario: Admin tra cứu danh sách connector có thống kê và phân trang
    Given hệ thống có các connector sau:
      | key     | name      | authType | isActive | credentialsCount | publishedWorkflowsCount |
      | google  | Google    | OAUTH2   | true     | 15               | 8                       |
      | slack   | Slack     | API_KEY  | true     | 5                | 2                       |
      | custom  | Custom    | NONE     | false    | 0                | 0                       |
    When Admin gửi yêu cầu "GET /api/admin/connectors?page=1&pageSize=20"
    Then hệ thống trả về mã trạng thái HTTP 200
    And danh sách chứa đủ 3 connector với đầy đủ trường:
      | field                |
      | id                   |
      | key                  |
      | name                 |
      | authType             |
      | isActive             |
      | allowNewCredentials  |
      | revision             |
      | credentialCount      |
      | workflowCount        |
      | createdAt            |
      | updatedAt            |
    And connector "google" có credentialCount = 15 và workflowCount = 8
    And response không chứa bất kỳ secret, apiKey, token hay thông tin nhạy cảm nào

  Scenario: Admin tìm kiếm và lọc connector
    Given danh mục connector có sẵn "Google Mail", "Google Drive", "Slack", "HubSpot"
    When Admin tìm kiếm với tham số "q=google&authType=OAUTH2"
    Then hệ thống chỉ trả về các connector có tên hoặc key khớp "google" và authType là "OAUTH2"
    And kết quả phân trang thể hiện đúng tổng số bản ghi thỏa điều kiện
```

#### BDD-CM-02: Thay đổi chính sách `allowNewCredentials` thành công (AC-CM-02, AC-CM-06)
```gherkin
  Scenario: Admin tạm dừng cấp credential mới cho connector thành công
    Given connector "slack" đang có chính sách "allowNewCredentials = true" với revision = 1
    When Admin gửi "PATCH /api/admin/connectors/slack-id/credential-policy" với payload:
      """
      {
        "allowNewCredentials": false,
        "reason": "Tam ngung tich hop Slack de audit bao mat",
        "expectedRevision": 1
      }
      """
    Then hệ thống trả về HTTP 200 kèm dữ liệu chính sách mới
    And bản ghi chính sách của "slack" có "allowNewCredentials = false" và revision = 2
    And một bản ghi kiểm toán "CONNECTOR_POLICY_CHANGED" được tạo trong "admin_audit_events":
      | action                   | targetId  | reason                                    |
      | CONNECTOR_POLICY_CHANGED | slack-id  | Tam ngung tich hop Slack de audit bao mat |
    And connector "slack" vẫn giữ nguyên trạng thái "isActive = true" trong catalog
```

#### BDD-CM-03: Kiểm soát xung đột phiên bản (Optimistic Concurrency) (AC-CM-06)
```gherkin
  Scenario: Admin gửi yêu cầu cập nhật chính sách với revision đã lỗi thời (Stale Revision)
    Given connector "google" hiện có revision = 3 trong cơ sở dữ liệu
    When Admin gửi "PATCH /api/admin/connectors/google-id/credential-policy" với payload:
      """
      {
        "allowNewCredentials": false,
        "reason": "Thu hoi quyen tao moi",
        "expectedRevision": 2
      }
      """
    Then hệ thống trả về mã trạng thái HTTP 409 Conflict
    And mã lỗi phản hồi là "STALE_REVISION"
    And chính sách của connector "google" không bị thay đổi
    And không có sự kiện kiểm toán mới nào được ghi nhận
```

#### BDD-CM-04: Xử lý yêu cầu No-op (AC-CM-06)
```gherkin
  Scenario: Admin gửi giá trị chính sách trùng với giá trị hiện tại
    Given connector "google" đang có "allowNewCredentials = false" và revision = 2
    When Admin gửi "PATCH /api/admin/connectors/google-id/credential-policy" với payload:
      """
      {
        "allowNewCredentials": false,
        "reason": "Goi lai cung gia tri",
        "expectedRevision": 2
      }
      """
    Then hệ thống trả về HTTP 200
    And revision vẫn giữ nguyên là 2
    And không có bản ghi kiểm toán "CONNECTOR_POLICY_CHANGED" nào được tạo
```

#### BDD-CM-05: Chặn tạo API Key Credential khi chính sách bị tắt (AC-CM-02)
```gherkin
  Scenario: Người dùng cố gắng tạo API Key credential cho connector đã bị tắt tạo mới
    Given connector "slack" có chính sách "allowNewCredentials = false"
    When người dùng gửi lệnh CreateApiKeyCredentialCommand cho "slack"
    Then hệ thống từ chối yêu cầu và ném ra ngoại lệ ConflictException
    And mã lỗi trả về là "CONNECTOR_NEW_CREDENTIALS_DISABLED"
    And không có bản ghi "ConnectorCredential" nào được lưu vào cơ sở dữ liệu
```

#### BDD-CM-06: Chặn khởi tạo luồng OAuth khi chính sách bị tắt (AC-CM-02)
```gherkin
  Scenario: Người dùng yêu cầu URL đăng nhập Google OAuth cho connector đã bị tắt tạo mới
    Given connector "google" có chính sách "allowNewCredentials = false"
    When người dùng gửi truy vấn GetGoogleAuthUrlQuery cho "google"
    Then hệ thống từ chối và trả về lỗi HTTP 409 Conflict
    And mã lỗi trả về là "CONNECTOR_NEW_CREDENTIALS_DISABLED"
    And URL xác thực Google không được sinh ra
```

#### BDD-CM-07: Bảo toàn credential cũ và thực thi workflow bình thường (AC-CM-03)
```gherkin
  Scenario: Workflow sử dụng credential đã tồn tại vẫn chạy và tự động refresh token bình thường
    Given connector "google" có chính sách "allowNewCredentials = false"
    And người dùng sở hữu credential "google-cred-1" được tạo trước đó
    And workflow "Sync-Gmail" đang xuất bản sử dụng "google-cred-1"
    When workflow "Sync-Gmail" được kích hoạt thực thi
    Then node thực thi lấy "google-cred-1" thành công
    And nếu access token hết hạn, tiến trình refresh token diễn ra thành công và cập nhật token mới
    And workflow hoàn tất với kết quả thành công mà không bị chặn bởi chính sách allowNewCredentials
```

#### BDD-CM-08: Chống Race Condition tại Callback hoàn tất OAuth (AC-CM-04)
```gherkin
  Scenario: Admin tắt chính sách trong lúc người dùng đang ở màn hình ủy quyền OAuth
    Given connector "google" có "allowNewCredentials = true" tại thời điểm người dùng bắt đầu OAuth
    And người dùng đang thao tác trên Google Consent Screen
    And trong lúc đó Admin cập nhật chính sách của "google" thành "allowNewCredentials = false"
    When Google chuyển hướng người dùng về callback với authorization code hợp lệ
    And backend thực thi HandleGoogleCallbackCommand trong transaction có khóa dòng policy
    Then backend phát hiện "allowNewCredentials = false"
    And transaction bị rollback hoàn toàn
    And không có bản ghi "ConnectorCredential" rác nào được lưu trữ
    And người dùng nhận được thông báo lỗi "CONNECTOR_NEW_CREDENTIALS_DISABLED"
```

#### BDD-CM-09: Bảo toàn chính sách quản trị qua khởi động lại và đồng bộ catalog (AC-CM-05)
```gherkin
  Scenario: Server khởi động lại và PackageCatalogSync chạy không ghi đè chính sách của Admin
    Given connector "google" đã được Admin thiết lập "allowNewCredentials = false" và revision = 5
    When tiến trình PackageCatalogSync khởi chạy và đồng bộ danh mục kỹ thuật
    Then bảng "connectors" được cập nhật các node definitions kỹ thuật mới nhất
    And giá trị "allowNewCredentials" trong bảng "connector_policies" của "google" vẫn là false
    And "revision" của "google" trong "connector_policies" vẫn là 5
```

#### BDD-CM-10: Cảnh báo trực quan trên Designer Client (AC-CM-02)
```gherkin
  Scenario: Người dùng mở modal kết nối trong Workflow Designer với connector bị tắt cấp mới
    Given connector "slack" có "allowNewCredentials = false"
    When người dùng mở cấu hình node Slack trong Workflow Designer
    Then danh sách dropdown hiển thị các credential Slack đã kết nối trước đó để người dùng chọn
    And nút "Tạo kết nối mới (Add New)" bị vô hiệu hóa hoặc hiển thị cảnh báo
    And hiển thị banner cảnh báo: "Quản trị viên hệ thống đã tạm dừng cấp kết nối mới cho dịch vụ này"
```
