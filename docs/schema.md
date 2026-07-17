## Nhóm bảng theo Bounded Context

### 1. Workflow Designer (workflow definition)

```
workflows
├── id (uuid, PK)
├── name
├── description
├── status          -- draft | published | archived
├── current_version_id (FK → workflow_versions.id, nullable)
├── created_by (FK → users.id)
├── created_at, updated_at

workflow_versions
├── id (uuid, PK)
├── workflow_id (FK → workflows.id)
├── version_number   -- tăng dần: 1, 2, 3...
├── definition       -- jsonb: toàn bộ graph (nodes + edges + config)
├── is_published
├── published_at
├── created_by
├── created_at
```

> Gợi ý: dùng **jsonb** cho `definition` (nodes/edges/config) thay vì tách bảng `nodes`/`edges` riêng ở giai đoạn này — vì workflow graph thay đổi cấu trúc linh hoạt, và mỗi lần publish là một snapshot bất biến (phù hợp FR-VM-01, FR-VM-02, FR-VM-03: compare/rollback chỉ là so sánh 2 bản jsonb).

### 2. Node Library (danh mục node có sẵn — không phải instance trong workflow)

```
node_definitions
├── id (uuid, PK)
├── type            -- trigger | logic | data_processing | integration
├── key              -- unique code, vd: "webhook_trigger", "gmail_send"
├── name
├── config_schema    -- jsonb: schema mô tả input/config cần thiết
├── connector_key (FK → connector_definitions.key, nullable, chỉ cho integration node)
├── is_active
```

### 3. Connector Framework

```
connector_definitions
├── id (uuid, PK)
├── key              -- unique: gmail, slack, http, postgresql, google_sheet, google_drive, openai, webhook
├── name
├── auth_type        -- api_key | oauth2 | basic

connector_credentials
├── id (uuid, PK)
├── connector_key (FK → connector_definitions.key)
├── owner_id (FK → users.id)   -- ai cấu hình credential này
├── name             -- label do user đặt (vd: "Gmail công ty")
├── encrypted_payload  -- bytea/text đã mã hóa (API key/OAuth token)
├── status           -- valid | invalid | expired
├── last_tested_at
├── created_at, updated_at
```

### 4. Workflow Execution Engine + Monitor (gộp chung vì quan hệ chặt)

```
executions
├── id (uuid, PK)
├── workflow_id (FK → workflows.id)
├── workflow_version_id (FK → workflow_versions.id)
├── trigger_type     -- manual | webhook | schedule
├── status           -- running | success | failed | timeout
├── started_at
├── finished_at
├── triggered_by     -- user_id hoặc null (webhook/schedule)

execution_node_runs
├── id (uuid, PK)
├── execution_id (FK → executions.id)
├── node_key         -- id của node trong definition (không FK cứng vì definition là jsonb)
├── status           -- pending | running | success | failed | skipped | timeout
├── retry_count
├── started_at
├── finished_at
```

> `execution_node_runs` đóng vai trò trung tâm cho cả **Execution Monitor** (FR-EM-01→04) lẫn phần khung của **Logs**.

### 5. Workflow Logs

```
execution_logs
├── id (bigint/uuid, PK)
├── execution_id (FK → executions.id)
├── execution_node_run_id (FK → execution_node_runs.id, nullable)
├── level            -- info | error
├── input            -- jsonb (đã che giá trị nhạy cảm)
├── output           -- jsonb
├── error_message
├── error_stack
├── created_at
```

> Bảng này sẽ tăng nhanh nhất theo thời gian (NFR-07) → giai đoạn sau tính đến partition theo `created_at` hoặc archive định kỳ, nhưng **chưa cần thiết kế ngay** ở phase hiện tại.

### 6. Users / phân quyền cơ bản (chưa nêu chi tiết trong SRS nhưng cần tối thiểu để FK ở trên hoạt động)

```
users
├── id (uuid, PK)
├── email
├── name
├── role             -- workflow_developer | administrator
├── created_at
```

---

## Quan hệ tổng quan (rút gọn)

```
workflows 1—N workflow_versions
workflows 1—N executions
workflow_versions 1—N executions
executions 1—N execution_node_runs
execution_node_runs 1—N execution_logs
connector_definitions 1—N connector_credentials
node_definitions N—1 connector_definitions (chỉ integration node)
users 1—N connector_credentials / workflows / executions
```

## Vài lưu ý khi triển khai (mức nguyên tắc, chưa đi sâu)

- **Modular monolith → schema theo module**: có thể cân nhắc dùng Postgres **schema namespace** riêng cho từng bounded context (`designer.*`, `execution.*`, `connector.*`, `logging.*`) để sau này tách microservice dễ hình dung ranh giới dữ liệu hơn — không bắt buộc nhưng đáng cân nhắc sớm.
- **jsonb cho phần "linh hoạt"** (workflow definition, node config_schema, log input/output) — tránh over-normalize graph structure ở giai đoạn MVP.
- **Không lưu credential dạng plaintext** — đúng NFR-04, `encrypted_payload` mã hóa ở tầng ứng dụng trước khi ghi DB.
- **execution_node_runs.node_key** cố tình không FK cứng tới node trong jsonb definition — vì definition là snapshot bất biến theo version, tránh ràng buộc phức tạp không cần thiết ở phase này.
- Phần **Entity Resolution** và **AI service adapter prompt engineering** (đã được đề cập trong SRS của Zero-input CRM trước đây, nếu áp dụng tương tự cho FlowPilot AI ở Phase Sau) nên để riêng technical design doc — schema ở trên chưa tính đến các bảng phục vụ AI generate/review workflow.
