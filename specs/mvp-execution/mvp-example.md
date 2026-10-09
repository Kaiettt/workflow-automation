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