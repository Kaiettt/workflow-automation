# Thiết kế: Giám sát Execution Toàn Nền Tảng (Execution Monitoring)

Status: ready-for-agent (P1)

## 1. Ranh giới Module và Phân tầng Kiến trúc

- **Presentation**: `AdminController` trong `libs/admin/src/presentation`:
  - `GET /api/admin/executions` -> `AdminReadQuery({ kind: 'executions', filter })`
  - `GET /api/admin/executions/:id` -> `AdminReadQuery({ kind: 'execution', id })`
- **Query Projection**:
  - `AdminReadPort.executions(filter: AdminExecutionFilter)`
  - `AdminReadPort.execution(id: string)`
  - Triển khai trong `PrismaAdminRead` (`libs/admin/src/infrastructure/prisma-admin-read.ts`):
    - Sử dụng các câu lệnh `SELECT` tĩnh với whitelist trường, tuyệt đối không dùng `select: { ... }` có chứa các cột payload.

## 2. Hợp đồng API và DTO Whitelist

### DTO Bộ lọc Execution
```typescript
export class AdminExecutionFilterDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsUUID()
  workflowId?: string;

  @IsOptional()
  @IsUUID()
  executionId?: string;

  @IsOptional()
  @IsEnum(['QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'])
  status?: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

  @IsOptional()
  @IsEnum(['MANUAL', 'WEBHOOK', 'SCHEDULE'])
  triggerType?: 'MANUAL' | 'WEBHOOK' | 'SCHEDULE';

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
```

### Whitelist Projection Select Query
```typescript
const executionListSelect = {
  id: true,
  workflowId: true,
  workflow: {
    select: {
      name: true,
      ownerId: true,
      owner: { select: { name: true, email: true } },
    },
  },
  versionId: true,
  version: { select: { versionNumber: true } },
  triggerType: true,
  status: true,
  queuedAt: true,
  startedAt: true,
  finishedAt: true,
  durationMs: true,
  errorCode: true,
  cancellationReason: true,
} as const;

const nodeLogSelect = {
  nodeId: true,
  nodeKey: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  durationMs: true,
  retryCount: true,
  errorCode: true,
} as const;
```

## 3. Đánh Chỉ mục Cơ sở Dữ liệu (Database Indexing)

Trong `prisma/schema.prisma`, bổ sung các chỉ mục phục vụ tìm kiếm và sắp xếp:
```prisma
model Execution {
  ...
  @@index([queuedAt, status])
  @@index([workflowId, queuedAt])
  @@index([status, queuedAt])
}
```

## 4. Thiết kế Giao diện Frontend

- `ExecutionsPage.tsx`:
  - `ExecutionFilterBar.tsx`:
    - Ô nhập `Owner Email` / ID.
    - Ô nhập `Execution ID`.
    - Dropdown chọn `Status` (All, Queued, Running, Success, Failed, Cancelled).
    - Dropdown chọn `Trigger Type` (All, Manual, Webhook, Schedule).
    - Bộ chọn thời gian (Quick 24h, 7d, 30d, custom).
  - `ExecutionTable.tsx`:
    - Cột: Execution ID (link tới chi tiết), Workflow, Owner, Trigger, Status badge, Queued At, Duration, Error Code, Nút xem chi tiết.
    - Không có bất kỳ nút can thiệp nào (Run, Retry, Cancel).
- `ExecutionDetailPage.tsx`:
  - Card thông tin tổng quan: ID, Workflow, Owner, Trạng thái, Thời gian vào hàng đợi, Bắt đầu, Kết thúc, Tổng thời gian chạy, Mã lỗi.
  - `NodeLogsTimeline.tsx`:
    - Bảng danh sách các node log đã chạy: Node Key, Trạng thái, Bắt đầu, Hoàn tất, Thời gian chạy, Retry count, Mã lỗi an toàn.
    - Không hiển thị custom label của node, không có nút xem raw JSON hay stack trace.
- Visible-only Polling Hook: `useAdminExecutions.ts` tự động refetch mỗi 30 giây khi tab active.
