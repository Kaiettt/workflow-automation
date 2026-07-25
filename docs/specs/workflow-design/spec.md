# Feature: Workflow Designer (MVP)

## Status

MVP

---

# Goal

Allow users to visually design a workflow using a drag-and-drop editor.

The workflow is stored as a graph (nodes + edges + viewport) inside `workflow_drafts.definition`.

At this stage, the system only supports designing and saving workflows. Workflow execution is out of scope.

---

# Technology Stack

- **Framework**: React.js
- **Workflow Canvas**: React Flow (`@xyflow/react`)
- **UI Components**: shadcn/ui (Tailwind CSS, Radix UI)
- **State Management**: Zustand

---

# Scope

Included

- Create workflow
- Open workflow (load draft)
- Drag node onto canvas
- Configure node
- Connect nodes
- Delete node
- Delete edge
- Move node
- Auto save draft

Excluded

- authentication & authorization
- Validate workflow (Out of scope for this phase)
- Publish workflow (Out of scope for this phase)
- Execute workflow
- Connector authentication
- Runtime validation
- Workflow scheduling
- Version comparison
- AI workflow generation

---

# Database Mapping
note: read from the schema.prisma and schema.md for better understand

| Table | Purpose |
|--------|----------|
| workflows | Workflow metadata |
| workflow_drafts | Current editable workflow |
| workflow_versions | Published immutable workflow |
| node_type_definitions | Node catalog |

---

# Workflow Definition

The workflow graph is stored inside

```
workflow_drafts.definition
```

Example

```json
{
  "nodes": [],
  "edges": [],
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  }
}
```

---

# User Flow

Create Workflow (POST /workflows)

↓

Open Designer (GET /workflows/:id/draft)

↓

Drag Nodes

↓

Configure Nodes

↓

Connect Nodes

↓

Auto Save Draft (PUT /workflows/:id/draft)

---

# Functional Requirements

## WD-01 Open Designer

Trường hợp 1: Tạo mới Workflow (New Workflow)
- Khi user mở giao diện designer để tạo mới, hệ thống tự động gọi API `POST /workflows`.
- **Block tương tác**: UI sẽ hiển thị trạng thái loading và KHÔNG cho phép user kéo, thả hay tương tác (drag & drop) cho đến khi API trả về thành công và có `workflowId`.
- Sau khi có `workflowId`, user bắt đầu thiết kế.

Trường hợp 2: Mở Workflow đã có (Existing Workflow)
- Khi user mở lại một designer đã lưu, hệ thống gọi API `GET /workflows/:id/draft` để tải lại trạng thái draft.
- Dữ liệu map trực tiếp vào:
```
workflow_drafts.definition
```

---

## WD-02 Add Node

User drags a node from the palette.

Example

```
Trigger

↓

Schedule
```

Designer appends a node into

```json
{
  "nodes": [
    {
      "id": "schedule_1",
      "type": "trigger.schedule",
      "position": {
        "x": 100,
        "y": 200
      },
      "data": {
        "name": "Every Morning",
        "config": {}
      }
    }
  ]
}
```

---

## WD-03 Move Node

Moving a node updates only

```
position.x

position.y
```

Example

Before

```json
{
  "position": {
    "x": 100,
    "y": 200
  }
}
```

After

```json
{
  "position": {
    "x": 380,
    "y": 260
  }
}
```

---

## WD-04 Configure Node

Each node has

```json
{
    "config":{}
}
```

The UI renders configuration fields using

```
node_type_definitions.config_schema
```

Mock schema Example

```json
{
  "cron": "0 7 * * *",
  "timezone": "Asia/Ho_Chi_Minh"
}
```

---

## WD-05 Connect Nodes

User connects two nodes.

Designer appends

```json
{
    "id":"edge_001",
    "source":"schedule_1",
    "target":"calendar_1"
}
```

into

```
definition.edges
```

---

## WD-06 Delete Node

Delete node

↓

Delete all connected edges

---

## WD-07 Delete Edge

Remove edge from

```
definition.edges
```

---

## WD-08 Auto Save

Whenever the workflow changes on the canvas, the application checks for updates.
Every two seconds, if there are unsaved changes, the designer serializes the graph and saves the draft to the database.
- API: `PUT /workflows/:id/draft`

Designer serializes

```json
{
    "nodes":[],
    "edges":[],
    "viewport":{}
}
```

Update

```
workflow_drafts.definition
```

---

# Mock Node Catalog

Current

Hardcode

```json
[
  {
    "key": "trigger.schedule",
    "displayName": "Schedule"
  },
  {
    "key": "google.calendar.get_events",
    "displayName": "Google Calendar"
  },
  {
    "key": "logic.if",
    "displayName": "If"
  },
  {
    "key": "data.format_text",
    "displayName": "Format Text"
  },
  {
    "key": "gmail.send_email",
    "displayName": "Send Email"
  }
]
```

Future

Load from

```
node_type_definitions
```

---

# Sample Implementation

📅 Daily Meeting Reminder

Business Problem

Mỗi sáng nhân viên muốn xem lịch họp hôm nay.

Workflow

```text
Schedule (7:00 AM)
        │
        ▼
Google Calendar - Get Today's Events
        │
        ▼
Has Events?
    ┌───┴────┐
    │        │
 No         Yes
    │        │
    ▼        ▼
 End     Format Summary
              │
              ▼
        Gmail Send Email
```

Stored as

```
workflow_drafts.definition
```

---

# Out of Scope

- Validate workflow
- Publish workflow
- Execution Engine
- Execution Context
- Connector API
- Google OAuth
- Gmail API
- Retry
- Variables
- Monitoring
- Logs