# High-Level-Flow
---

## 1. Workflow Creation Flow — Luồng tạo Workflow

```mermaid
flowchart TD

U["1. User mở Workflow Designer"]

subgraph FlowPilot
    D["2. Workflow Designer"]
    NL["3. Node Library"]
    CF["4. Connector Framework"]
    V["6. Workflow Validator"]
    VM["8. Version Manager"]
    R[("Workflow Repository")]
end

subgraph External["External Systems"]
    Gmail["Gmail"]
    Slack["Slack"]
    Sheets["Google Sheets"]
    HTTP["HTTP API"]
end

U --> D
NL -->|"3. Kéo node vào canvas"| D
D -->|"4. Configure Connector"| CF

CF -.->|"5. Test Connection"| Gmail
CF -.->|"5. Test Connection"| Slack
CF -.->|"5. Test Connection"| Sheets
CF -.->|"5. Test Connection"| HTTP

D -->|"7a. Save Draft"| R
D -->|"7b. Publish"| V

V -->|"6a. Validation Failed → quay lại sửa"| D
V -->|"6b. Validation Passed"| VM

VM -->|"8. Create Version"| R
R --> P["9. Published Workflow"]
```

**Các bước:**

1. Người dùng mở **Workflow Designer**.
2. Kéo node từ **Node Library** vào workflow.
3. Chọn **Connector** (Gmail, Slack, Sheets, HTTP API...).
4. **Connector Framework** kiểm tra credential.
5. Test kết nối tới hệ thống ngoài tương ứng.
6. Người dùng bấm **Save Draft** (lưu tạm) hoặc **Publish** (gửi kiểm tra).
7. **Workflow Validator** kiểm tra: nếu **fail** → quay về Designer; nếu **pass** → chuyển tiếp.
8. **Version Manager** tạo phiên bản mới, lưu vào **Repository**.
9. Workflow trở thành **Published Workflow**, sẵn sàng chạy.

---

## 2. Workflow Execution Flow — Manual Trigger

```mermaid
flowchart TD

U["1. User bấm Run Workflow"] --> API["2. API nhận request"]

subgraph FlowPilot
    API
    Engine["3. Workflow Engine"]
    Instance["4. Tạo Workflow Instance"]
    Execute["5. Execute Nodes"]
    Connector["6. Connector Framework"]
    Logs["8. Execution Logs"]
    Monitor["9. Execution Monitor"]
end

subgraph External["External Services"]
    Gmail
    Slack
    Sheets["Google Sheets"]
    HTTP["REST API"]
end

API --> Engine --> Instance --> Execute
Execute -->|"6. Gặp Integration Node"| Connector

Connector -->|"7a"| Gmail
Connector -->|"7b"| Slack
Connector -->|"7c"| Sheets
Connector -->|"7d"| HTTP

Gmail -->|"7. Trả kết quả"| Connector
Slack -->|"7. Trả kết quả"| Connector
Sheets -->|"7. Trả kết quả"| Connector
HTTP -->|"7. Trả kết quả"| Connector

Connector --> Execute
Execute --> Logs --> Monitor
Monitor --> Success["10. Execution Completed"]
```

**Các bước:**

1. Người dùng bấm **Run Workflow**.
2. Request được gửi tới **API**.
3. API chuyển tới **Workflow Engine**.
4. Engine **tạo Workflow Instance** mới.
5. Engine bắt đầu **thực thi các node** tuần tự.
6. Gặp node tích hợp → gọi **Connector Framework**.
7. Connector gửi request tới Gmail / Slack / Sheets / HTTP API và nhận kết quả trả về.
8. Kết quả được đưa trở lại **Execute Nodes**, ghi vào **Execution Logs**.
9. **Execution Monitor** theo dõi trạng thái.
10. Workflow hoàn tất — **Execution Completed**.

---

## 3. Workflow Execution Flow — Webhook Trigger

```mermaid
flowchart TD

subgraph Ext["External System"]
    Shopify
    ERP
    CRM
end

Shopify -->|"1a. POST Webhook"| Gateway
ERP -->|"1b. POST Webhook"| Gateway
CRM -->|"1c. POST Webhook"| Gateway

subgraph FlowPilot
    Gateway["2. Webhook Endpoint"]
    Validate["3. Validate Request"]
    Engine["4. Workflow Engine"]
    Instance["5. Tạo Workflow Instance"]
    Execute["6. Execute Nodes"]
    Connector["7. Connector Framework"]
    Logs["9. Execution Logs"]
    Monitor["10. Execution Monitor"]
end

Gateway --> Validate --> Engine --> Instance --> Execute
Execute --> Connector

Connector --> Gmail
Connector --> Slack
Connector --> HTTP["HTTP API"]

Connector -->|"8. Kết quả"| Execute
Execute --> Logs --> Monitor
Monitor --> Done["11. Execution Completed"]
```

**Các bước:**

1. Hệ thống ngoài (**Shopify, ERP, CRM**) phát sinh sự kiện, gửi **HTTP POST** tới Webhook Endpoint.
2. **Gateway** tiếp nhận request.
3. Gateway **Validate Request** (kiểm tra chữ ký/token, đảm bảo hợp lệ và đáng tin).
4. Request hợp lệ được chuyển vào **Workflow Engine**.
5. Engine **tạo Workflow Instance** ứng với webhook đó.
6. Engine **thực thi các node**.
7. Gặp node tích hợp → gọi **Connector Framework** (Gmail, Slack, HTTP API...).
8. Connector trả kết quả về lại Execute Nodes.
9. Ghi **Execution Logs**.
10. **Execution Monitor** cập nhật trạng thái.
11. Kết thúc — **Execution Completed**.

---

## 4. Workflow Execution Flow — Scheduled Trigger

```mermaid
flowchart TD

Scheduler["1. Cron Scheduler"] --> Scan["2. Find Due Workflows"]

Scan --> Engine

subgraph FlowPilot
    Engine["3. Workflow Engine"]
    Instance["4. Tạo Workflow Instance"]
    Execute["5. Execute Nodes"]
    Connector["6. Connector Framework"]
    Logs["8. Execution Logs"]
    Monitor["9. Execution Monitor"]
end

subgraph External["External Services"]
    Gmail
    Slack
    Sheets["Google Sheets"]
    HTTP["REST API"]
end

Engine --> Instance --> Execute --> Connector

Connector --> Gmail
Connector --> Slack
Connector --> Sheets
Connector --> HTTP

Connector -->|"7. Kết quả"| Execute
Execute --> Logs --> Monitor
Monitor --> Success["10. Execution Completed"]
```

**Các bước:**

1. **Cron Scheduler** chạy theo lịch định kỳ (ví dụ mỗi ngày 8h sáng).
2. Scheduler thực hiện **Find Due Workflows** — quét các workflow đến hạn.
3. Gửi yêu cầu chạy tới **Workflow Engine**.
4. Engine **tạo Workflow Instance**.
5. Engine **thực thi các node**.
6. Gặp node tích hợp → gọi **Connector Framework**.
7. Connector gọi Gmail/Slack/Sheets/HTTP API và nhận kết quả.
8. Ghi **Execution Logs**.
9. **Execution Monitor** cập nhật trạng thái.
10. Kết thúc — **Execution Completed**.

---

## 5. Tổng quan kiến trúc Run-time

```mermaid
flowchart TD

subgraph Triggers["1. Nguồn kích hoạt"]
    Users["Users (Manual)"]
    Shopify["Shopify (Webhook)"]
    CRM["CRM (Webhook)"]
    ERP["ERP (Webhook)"]
    Scheduler["Scheduler (Cron)"]
end

subgraph FlowPilot
    Designer["Designer"]
    Repository[("Workflow Repository")]
    Engine["2. Workflow Engine"]
    Connector["3. Connector Framework"]
    Logs["5. Execution Logs"]
    Monitor["6. Execution Monitor"]
end

subgraph Services["External Services"]
    Gmail
    Slack
    GoogleSheets["Google Sheets"]
    RESTAPI["REST API"]
end

Users --> Designer --> Repository

Users -->|"1a"| Engine
Shopify -->|"1b"| Engine
CRM -->|"1c"| Engine
ERP -->|"1d"| Engine
Scheduler -->|"1e"| Engine

Engine --> Connector

Connector --> Gmail
Connector --> Slack
Connector --> GoogleSheets
Connector --> RESTAPI

Connector -->|"4. Kết quả trả về"| Engine

Engine --> Logs --> Monitor
```

**Các bước / điểm kiến trúc chính:**

1. Có 5 nguồn có thể kích hoạt hệ thống: **Users** (chạy tay), **Shopify / CRM / ERP** (webhook), **Scheduler** (lịch trình). Riêng luồng thiết kế: Users dùng **Designer** để tạo workflow, lưu vào **Repository**.
2. Dù đến từ nguồn nào, tất cả đều hội tụ về **Workflow Engine** — điểm xử lý trung tâm duy nhất.
3. Engine gọi ra ngoài luôn thông qua **Connector Framework** — không có đường tắt nào bỏ qua lớp này.
4. Connector gọi tới Gmail / Slack / Google Sheets / REST API, rồi trả kết quả ngược về Engine.
5. Toàn bộ hoạt động được ghi vào **Execution Logs**.
6. **Execution Monitor** đọc log để giám sát trạng thái thực thi theo thời gian thực.