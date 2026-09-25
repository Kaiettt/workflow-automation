# Sample Data cho Workflow: Daily Slack Notification

Dưới đây là dữ liệu mẫu mô phỏng cho toàn bộ các bảng trong schema (trừ bảng `users`). Nó thể hiện sự liên kết dữ liệu xuyên suốt từ lúc định nghĩa Node, thiết lập Connector, thiết kế Workflow, Publish Version cho tới quá trình Thực thi (Execution).

**Kịch bản (Scenario):** Workflow chạy định kỳ mỗi ngày lúc 8:00 sáng để gửi tin nhắn chào buổi sáng vào một kênh Slack.

*Giả định có một user đã tồn tại trong bảng `users` với ID là `u-123`.*

---

## 1. Node Library & Connectors (Dữ liệu tĩnh / Hệ thống)

Dữ liệu về các cổng kết nối và các loại node mà hệ thống hỗ trợ.

### Bảng `connectors`
| id | key | name | auth_type | config_schema | is_active |
|---|---|---|---|---|---|
| `conn-slack` | `slack` | Slack | `OAUTH2` | `{"type": "object", "properties": {"workspace": {"type": "string"}}}` | `true` |

### Bảng `node_type_definitions`
| id | key | name | category | description | config_schema | connector_id |
|---|---|---|---|---|---|---|
| `nt-sched` | `trigger.schedule` | Lịch trình (Cron) | `TRIGGER` | Kích hoạt tự động theo thời gian | `{"properties": {"cronExpression": {"type": "string"}}}` | `null` |
| `nt-slack` | `integration.slack.postMessage` | Gửi tin nhắn Slack | `INTEGRATION` | Gửi message tới một channel | `{"properties": {"channel": {"type": "string"}, "text": {"type": "string"}}}` | `conn-slack` |

---

## 2. Connector Credentials (Dữ liệu ủy quyền)

Dữ liệu do User `u-123` cấp quyền (VD: Đã login bằng Slack OAuth2).

### Bảng `connector_credentials`
| id | connector_id | owner_id | name | encrypted_secret | last_test_status |
|---|---|---|---|---|---|
| `cred-slack-1` | `conn-slack` | `u-123` | Slack của Công ty | `[ENCRYPTED_AES_256_GCM_STRING]` | `SUCCESS` |

---

## 3. Designer Module (Workflow, Version & Draft)

### Bảng `workflows`
Thông tin chung của workflow.
| id | name | description | status | owner_id | current_version_id | created_at |
|---|---|---|---|---|---|---|
| `wf-1` | Daily Morning Update | Báo cáo sáng mỗi 8AM | `PUBLISHED` | `u-123` | `wv-2` | `2026-07-01...` |

*(Lưu ý: Workflow này đang ở trạng thái PUBLISHED và phiên bản chạy thực tế là Version 2 - ID `wv-2`)*

### Bảng `workflow_versions`
Lịch sử các lần Publish của `wf-1`.
| id | workflow_id | version_number | definition (Lưu JSON) | published_at | published_by_id |
|---|---|---|---|---|---|
| `wv-1` | `wf-1` | 1 | `{"nodes": [{"id": "n1", "type": "trigger.schedule"}], "edges": []}` | `2026-07-10T10:00` | `u-123` |
| `wv-2` | `wf-1` | 2 | `{"nodes": [{"id": "n1", "type": "trigger.schedule"}, {"id": "n2", "type": "integration.slack.postMessage", "data": {"config": {"credential_id": "cred-slack-1"}}}], "edges": [{"source": "n1", "target": "n2"}]}` | `2026-07-15T14:30` | `u-123` |

### Bảng `workflow_drafts`
Bản nháp hiện tại. Giả sử sau khi Publish Version 2, User đang thử mở Editor lên để gắn thêm gửi Mail nhưng chưa Publish.
| workflow_id | definition (JSON đang thao tác) | validation_errors | locked_by_id | updated_at |
|---|---|---|---|---|
| `wf-1` | `{"nodes": [{"id": "n1", ...}, {"id": "n2", ...}, {"id": "n3", "type": "integration.gmail.send"}], "edges": [...]}` | `null` | `u-123` (đang mở tab) | `2026-07-18T23:40` |

---

## 4. Execution Module (Lịch sử chạy)

### Bảng `executions`
1 lần chạy thực tế của Workflow này vào sáng nay lúc 8:00.
| id | workflow_id | workflow_version_id | trigger_type | status | triggered_by_id | started_at | finished_at | duration_ms |
|---|---|---|---|---|---|---|---|---|
| `ex-99` | `wf-1` | `wv-2` | `SCHEDULE` | `SUCCESS` | `null` | `2026-07-18T08:00:00` | `2026-07-18T08:00:02` | `2000` |

### Bảng `execution_node_logs`
Chi tiết kết quả thực thi của từng node trong lần chạy `ex-99` ở trên.
| id | execution_id | node_id | node_key | status | input (JSON) | output (JSON) | error_message | started_at | duration_ms |
|---|---|---|---|---|---|---|---|---|---|
| `log-1` | `ex-99` | `n1` | `trigger.schedule` | `SUCCESS` | `null` | `{"triggerTime": "2026-07-18T08:00:00Z"}` | `null` | `08:00:00` | `10` |
| `log-2` | `ex-99` | `n2` | `integration.slack.postMessage`| `SUCCESS` | `{"channel": "#general", "text": "Chào buổi sáng!"}` | `{"message_id": "ts-12345678", "delivered": true}` | `null` | `08:00:00` | `1990` |

# Workflow Demo: Google Sheets → Filter → Gmail

Một trong những workflow đơn giản nhưng rất trực quan để demo FlowPilot là tự động gửi email từ dữ liệu trong Google Sheets.

## Use Case

Đội Sales hoặc Marketing quản lý danh sách khách hàng trong Google Sheets.

Khi người dùng bấm **Run Workflow**, FlowPilot sẽ:

1. Đọc dữ liệu từ Google Sheets.
2. Lọc các khách hàng chưa được liên hệ.
3. Gửi email tự động cho từng khách hàng phù hợp.

---

## Workflow Diagram

```text
Google Sheets
(Read Rows)
      ↓
Filter
(status == "new")
      ↓
Gmail
(Send Email)
```

---

## Sample Sheet Data

| Name | Email | Status |
|--------|--------|--------|
| Kiet | kiet@gmail.com | new |
| An | an@gmail.com | contacted |
| Minh | minh@gmail.com | new |

---

## Node Configuration

### 1. Google Sheets - Read Rows

**Purpose:** Read customer records from a spreadsheet.

**Output:**

```json
[
  {
    "name": "Kiet",
    "email": "kiet@gmail.com",
    "status": "new"
  },
  {
    "name": "An",
    "email": "an@gmail.com",
    "status": "contacted"
  },
  {
    "name": "Minh",
    "email": "minh@gmail.com",
    "status": "new"
  }
]
```

---

### 2. Filter

**Condition:**

```javascript
status == "new"
```

**Output:**

```json
[
  {
    "name": "Kiet",
    "email": "kiet@gmail.com",
    "status": "new"
  },
  {
    "name": "Minh",
    "email": "minh@gmail.com",
    "status": "new"
  }
]
```

---

### 3. Gmail - Send Email

FlowPilot executes this node once for every item returned by the Filter node.

#### Email Template

```yaml
to: {{email}}
subject: Welcome {{name}}
body: |
  Hi {{name}},

  Thanks