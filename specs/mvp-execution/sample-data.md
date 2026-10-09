> **Manual → Google Sheet → Filter → Gmail**

thì dữ liệu seed cho các bảng bạn hỏi có thể thiết kế như sau. Mình bám theo schema hiện tại của document: `workflow_drafts` chứa graph đang edit, `workflow_versions` chứa graph immutable sau publish, còn `node_type_definitions` là catalog của node type; connector và credential tách riêng. 

Giả sử user là:

```text
User: Kiet Nguyen
user_id: 11111111-1111-1111-1111-111111111111
```

---

## 1. `connectors`

Có 1 connector duy nhất cho toàn bộ Google (Sheets + Gmail):

| id         | key            | name          | auth_type |
| ---------- | -------------- | ------------- | --------- |
| `c-google` | `google`       | Google        | OAUTH2    |

Ví dụ:

```json
[
  {
    "id": "22222222-2222-2222-2222-222222222221",
    "key": "google",
    "name": "Google",
    "auth_type": "OAUTH2",
    "config_schema": {
      "type": "object",
      "properties": {
        "client_id": {
          "type": "string"
        }
      }
    },
    "is_active": true
  }
]
```

Trong schema hiện tại, `connectors` là catalog connector cố định; `config_schema` mô tả credential configuration. 

---

# 2. `connector_credentials`

User connect Google account (xin cấp quyền spreadsheets.readonly và gmail.send):

```text
Google account → Google (Sheets + Gmail)
```

Ta có 1 credential duy nhất:

```json
[
  {
    "id": "33333333-3333-3333-3333-333333333331",
    "connector_id": "22222222-2222-2222-2222-222222222221",
    "owner_id": "11111111-1111-1111-1111-111111111111",
    "name": "My Google Account",
    "encrypted_secret": "<AES-256-GCM encrypted OAuth credential with both scopes>",
    "last_tested_at": "2026-09-25T10:00:00Z",
    "last_test_status": "SUCCESS"
  }
]
```

**Không seed plaintext token**. Document quy định credential phải được mã hóa AES-256-GCM ở application layer. 

---

# 3. `node_type_definitions`

MVP này cần **3 node type**:

```text
trigger.manual
integration.google_sheet.readRows
logic.filter
integration.gmail.send
```

Thực ra là **4 node** nếu Manual Trigger cũng là node.

### `trigger.manual`

```json
{
  "id": "44444444-4444-4444-4444-444444444441",
  "key": "trigger.manual",
  "display_name": "Manual Trigger",
  "icon": "play",
  "color": "#6B7280",
  "category": "TRIGGER",
  "description": "Manually start a workflow",
  "config_schema": {
    "type": "object",
    "properties": {}
  },
  "input_schema": null,
  "output_schema": {
    "type": "object"
  },
  "connector_id": null,
  "is_active": true
}
```

### `integration.google_sheet.readRows`

```json
{
  "id": "44444444-4444-4444-4444-444444444442",
  "key": "integration.google_sheet.readRows",
  "display_name": "Read Google Sheet Rows",
  "icon": "table",
  "color": "#34A853",
  "category": "INTEGRATION",
  "description": "Read rows from a Google Sheet",
  "config_schema": {
    "type": "object",
    "required": [
      "credential_id",
      "spreadsheet_id",
      "sheet_name"
    ],
    "properties": {
      "credential_id": {
        "type": "string",
        "x-connectorKey": "google"
      },
      "spreadsheet_id": {
        "type": "string"
      },
      "sheet_name": {
        "type": "string"
      }
    }
  },
  "input_schema": {
    "type": "object"
  },
  "output_schema": {
    "type": "array",
    "items": {
      "type": "object"
    }
  },
  "connector_id": "22222222-2222-2222-2222-222222222221",
  "is_active": true
}
```

### `logic.filter`

```json
{
  "id": "44444444-4444-4444-4444-444444444443",
  "key": "logic.filter",
  "display_name": "Filter",
  "icon": "filter",
  "color": "#8B5CF6",
  "category": "LOGIC",
  "description": "Filter items based on a condition",
  "config_schema": {
    "type": "object",
    "required": [
      "field",
      "operator",
      "value"
    ],
    "properties": {
      "field": {
        "type": "string",
        "x-allowExpression": true
      },
      "operator": {
        "type": "string",
        "enum": [
          "equals",
          "not_equals",
          "contains"
        ]
      },
      "value": {
        "type": "string",
        "x-allowExpression": true
      }
    }
  },
  "input_schema": {
    "type": "array"
  },
  "output_schema": {
    "type": "array"
  },
  "connector_id": null,
  "is_active": true
}
```

### `integration.gmail.send`

```json
{
  "id": "44444444-4444-4444-4444-444444444444",
  "key": "integration.gmail.send",
  "display_name": "Send Gmail",
  "icon": "mail",
  "color": "#EA4335",
  "category": "INTEGRATION",
  "description": "Send an email using Gmail",
  "config_schema": {
    "type": "object",
    "required": [
      "credential_id",
      "to",
      "subject",
      "body"
    ],
    "properties": {
      "credential_id": {
        "type": "string",
        "x-connectorKey": "google"
      },
      "to": {
        "type": "string",
        "x-allowExpression": true
      },
      "subject": {
        "type": "string",
        "x-allowExpression": true
      },
      "body": {
        "type": "string",
        "x-allowExpression": true
      }
    }
  },
  "input_schema": {
    "type": "object"
  },
  "connector_id": "22222222-2222-2222-2222-222222222221",
  "is_active": true
}
```

Điểm quan trọng là `node_type_definitions` chỉ định nghĩa **node có thể dùng**, còn node thực tế nằm trong `workflow_versions.definition`. Document cũng xác định `key` là cách instance tham chiếu tới catalog. 

---

# 4. `workflows`

Tạo workflow:

```json
{
  "id": "55555555-5555-5555-5555-555555555555",
  "name": "Send Welcome Email to New Customers",
  "description": "Read new customers from Google Sheets and send welcome emails",
  "status": "PUBLISHED",
  "owner_id": "11111111-1111-1111-1111-111111111111",
  "current_version_id": "77777777-7777-7777-7777-777777777771"
}
```

---

# 5. `workflow_drafts`

Đây là graph mà user đang chỉnh sửa trong Designer.

```json
{
  "workflow_id": "55555555-5555-5555-5555-555555555555",
  "definition": {
    "nodes": [
      {
        "id": "node-manual",
        "type": "trigger.manual",
        "position": {
          "x": 100,
          "y": 200
        },
        "data": {
          "name": "Start",
          "config": {}
        }
      },
      {
        "id": "node-sheet",
        "type": "integration.google_sheet.readRows",
        "position": {
          "x": 400,
          "y": 200
        },
        "data": {
          "name": "Read Customers",
          "config": {
            "credential_id": "33333333-3333-3333-3333-333333333331",
            "spreadsheet_id": "1ABCxyzCustomerSheet",
            "sheet_name": "Customers"
          }
        }
      },
      {
        "id": "node-filter",
        "type": "logic.filter",
        "position": {
          "x": 700,
          "y": 200
        },
        "data": {
          "name": "Only New Customers",
          "config": {
            "field": "status",
            "operator": "equals",
            "value": "new"
          }
        }
      },
      {
        "id": "node-gmail",
        "type": "integration.gmail.send",
        "position": {
          "x": 1000,
          "y": 200
        },
        "data": {
          "name": "Send Welcome Email",
          "config": {
            "credential_id": "33333333-3333-3333-3333-333333333331",
            "to": "{{email}}",
            "subject": "Welcome, {{name}}!",
            "body": "Hi {{name}},\n\nThanks for joining us!"
          }
        }
      }
    ],
    "edges": [
      {
        "id": "edge-1",
        "source": "node-manual",
        "target": "node-sheet"
      },
      {
        "id": "edge-2",
        "source": "node-sheet",
        "target": "node-filter"
      },
      {
        "id": "edge-3",
        "source": "node-filter",
        "target": "node-gmail"
      }
    ],
    "viewport": {
      "x": 0,
      "y": 0,
      "zoom": 1
    }
  },
  "validation_errors": null,
  "locked_by_id": null,
  "locked_at": null
}
```

Cấu trúc này đúng với design hiện tại: `definition` chứa `nodes`, `edges`, `viewport`; mỗi node có `id`, `type`, `position`, `data.config`. 

---

# 6. `workflow_versions`

Khi user **Publish**, copy definition từ draft thành version immutable:

```json
{
  "id": "77777777-7777-7777-7777-777777777771",
  "workflow_id": "55555555-5555-5555-5555-555555555555",
  "version_number": 1,
  "definition": {
    "nodes": [
      {
        "id": "node-manual",
        "type": "trigger.manual",
        "position": {
          "x": 100,
          "y": 200
        },
        "data": {
          "name": "Start",
          "config": {}
        }
      },
      {
        "id": "node-sheet",
        "type": "integration.google_sheet.readRows",
        "position": {
          "x": 400,
          "y": 200
        },
        "data": {
          "name": "Read Customers",
          "config": {
            "credential_id": "33333333-3333-3333-3333-333333333331",
            "spreadsheet_id": "1ABCxyzCustomerSheet",
            "sheet_name": "Customers"
          }
        }
      },
      {
        "id": "node-filter",
        "type": "logic.filter",
        "position": {
          "x": 700,
          "y": 200
        },
        "data": {
          "name": "Only New Customers",
          "config": {
            "field": "status",
            "operator": "equals",
            "value": "new"
          }
        }
      },
      {
        "id": "node-gmail",
        "type": "integration.gmail.send",
        "position": {
          "x": 1000,
          "y": 200
        },
        "data": {
          "name": "Send Welcome Email",
          "config": {
            "credential_id": "33333333-3333-3333-3333-333333333331",
            "to": "{{email}}",
            "subject": "Welcome, {{name}}!",
            "body": "Hi {{name}},\n\nThanks for joining us!"
          }
        }
      }
    ],
    "edges": [
      {
        "id": "edge-1",
        "source": "node-manual",
        "target": "node-sheet"
      },
      {
        "id": "edge-2",
        "source": "node-sheet",
        "target": "node-filter"
      },
      {
        "id": "edge-3",
        "source": "node-filter",
        "target": "node-gmail"
      }
    ],
    "viewport": {
      "x": 0,
      "y": 0,
      "zoom": 1
    }
  },
  "published_at": "2026-09-25T10:30:00Z",
  "published_by_id": "11111111-1111-1111-1111-111111111111"
}
```

`workflow_versions` theo document là **immutable**, chỉ tồn tại khi publish và có `version_number` tăng dần theo workflow. 

---

## Tổng thể data relationship

```text
User
 │
 ├─────────────── Workflow
 │                    │
 │                    ├── Draft
 │                    │     └── definition JSON
 │                    │
 │                    └── Version 1
 │                          └── definition JSON
 │
 ├── Google Sheet Credential
 │       └── Google Sheets Connector
 │
 └── Gmail Credential
         └── Gmail Connector


Node Type Definitions
 │
 ├── trigger.manual
 ├── integration.google_sheet.readRows
 ├── logic.filter
 └── integration.gmail.send
```

Và **điểm quan trọng nhất**: `workflow_versions.definition` không tạo FK tới từng node instance. Nó chỉ chứa `type` như `integration.gmail.send`, rồi Execution Engine lookup `node_type_definitions.key`. Đây đúng với thiết kế hiện tại của bạn. 

Nếu chỉ làm **MVP**, mình sẽ seed đúng **4 node types + 2 connectors + 2 credentials + 1 workflow + 1 draft + 1 version** như trên, chưa cần thêm `Webhook`, `Schedule`, `App Script`, hay `Google Sheet event`.

---

# 7. `executions`

Đại diện cho một lần chạy (run) của workflow trên (Trigger Manual).

```json
{
  "id": "88888888-8888-8888-8888-888888888881",
  "workflow_id": "55555555-5555-5555-5555-555555555555",
  "workflow_version_id": "77777777-7777-7777-7777-777777777771",
  "trigger_type": "MANUAL",
  "status": "SUCCESS",
  "triggered_by_id": "11111111-1111-1111-1111-111111111111",
  "started_at": "2026-09-25T11:00:00Z",
  "finished_at": "2026-09-25T11:00:03Z",
  "duration_ms": 3050,
  "context": null
}
```

---

# 8. `execution_node_logs`

Chứa chi tiết thực thi của từng node trong lần chạy đó. Dựa theo data sample trong `mvp-example.md`, workflow sẽ chạy qua 4 node. Do Gmail node nhận được 2 item từ Filter node, nó có thể được log như 1 node execution với mảng kết quả, hoặc tuỳ thiết kế engine. Dưới đây là cách tiếp cận log 1 lần cho mỗi node.

```json
[
  {
    "id": "99999999-9999-9999-9999-999999999991",
    "execution_id": "88888888-8888-8888-8888-888888888881",
    "node_id": "node-manual",
    "node_key": "trigger.manual",
    "status": "SUCCESS",
    "input": null,
    "output": {
      "triggered_by": "Kiet Nguyen",
      "timestamp": "2026-09-25T11:00:00Z"
    },
    "error_message": null,
    "error_stack": null,
    "retry_count": 0,
    "started_at": "2026-09-25T11:00:00.000Z",
    "finished_at": "2026-09-25T11:00:00.050Z",
    "duration_ms": 50
  },
  {
    "id": "99999999-9999-9999-9999-999999999992",
    "execution_id": "88888888-8888-8888-8888-888888888881",
    "node_id": "node-sheet",
    "node_key": "integration.google_sheet.readRows",
    "status": "SUCCESS",
    "input": {
      "spreadsheet_id": "1ABCxyzCustomerSheet",
      "sheet_name": "Customers"
    },
    "output": [
      { "name": "Kiet", "email": "kiet@gmail.com", "status": "new" },
      { "name": "An", "email": "an@gmail.com", "status": "contacted" },
      { "name": "Minh", "email": "minh@gmail.com", "status": "new" }
    ],
    "error_message": null,
    "error_stack": null,
    "retry_count": 0,
    "started_at": "2026-09-25T11:00:00.050Z",
    "finished_at": "2026-09-25T11:00:01.550Z",
    "duration_ms": 1500
  },
  {
    "id": "99999999-9999-9999-9999-999999999993",
    "execution_id": "88888888-8888-8888-8888-888888888881",
    "node_id": "node-filter",
    "node_key": "logic.filter",
    "status": "SUCCESS",
    "input": {
      "data": [
        { "name": "Kiet", "email": "kiet@gmail.com", "status": "new" },
        { "name": "An", "email": "an@gmail.com", "status": "contacted" },
        { "name": "Minh", "email": "minh@gmail.com", "status": "new" }
      ],
      "condition": { "field": "status", "operator": "equals", "value": "new" }
    },
    "output": [
      { "name": "Kiet", "email": "kiet@gmail.com", "status": "new" },
      { "name": "Minh", "email": "minh@gmail.com", "status": "new" }
    ],
    "error_message": null,
    "error_stack": null,
    "retry_count": 0,
    "started_at": "2026-09-25T11:00:01.550Z",
    "finished_at": "2026-09-25T11:00:01.560Z",
    "duration_ms": 10
  },
  {
    "id": "99999999-9999-9999-9999-999999999994",
    "execution_id": "88888888-8888-8888-8888-888888888881",
    "node_id": "node-gmail",
    "node_key": "integration.gmail.send",
    "status": "SUCCESS",
    "input": {
      "items": [
        {
          "to": "kiet@gmail.com",
          "subject": "Welcome, Kiet!",
          "body": "Hi Kiet,\n\nThanks for joining us!"
        },
        {
          "to": "minh@gmail.com",
          "subject": "Welcome, Minh!",
          "body": "Hi Minh,\n\nThanks for joining us!"
        }
      ]
    },
    "output": {
      "sent_count": 2,
      "success_count": 2,
      "failed_count": 0
    },
    "error_message": null,
    "error_stack": null,
    "retry_count": 0,
    "started_at": "2026-09-25T11:00:01.560Z",
    "finished_at": "2026-09-25T11:00:03.050Z",
    "duration_ms": 1490
  }
]
```
