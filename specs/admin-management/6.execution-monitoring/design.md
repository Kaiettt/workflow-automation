# Thiết kế: Giám sát Execution Toàn Nền Tảng (Execution Monitoring)

Status: implemented (P1, 2026-11-24)

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
export class AdminExecutionFilterDto extends PageDto {
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
  @IsIn(['QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'])
  status?: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

  @IsOptional()
  @IsIn(['MANUAL', 'WEBHOOK', 'SCHEDULE'])
  triggerType?: 'MANUAL' | 'WEBHOOK' | 'SCHEDULE';

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
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
  workflowVersionId: true,
  workflowVersion: { select: { versionNumber: true } },
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
  @@index([queuedAt(sort: Desc), id(sort: Desc)])
  @@index([status, queuedAt(sort: Desc), id(sort: Desc)])
}
```

## 4. Thiết kế Giao diện Frontend

- `ExecutionsPage.tsx`:
  - `ExecutionFilterBar.tsx`:
    - Tìm owner bằng tên/email qua API users và chọn ownerId UUID.
    - Ô nhập `Workflow ID` UUID.
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

## 5. Contract và seams

- DTO extends PageDto tái sử dụng numeric transform; timestamp có timezone, validate range trước dispatch.
- ReadPort trả types cụ thể. Prisma select whitelist tĩnh, map ORM sang response; sanitize error/cancellation codes.
- Reuse index workflow/queuedAt/id hiện có; hai index mới phục vụ global list/sort, không thêm workflow index trùng.
- Owner picker dùng API users; workflow UUID có control riêng. Filters/page ở URL; routes nằm dưới AdminGuard.
- Visibility hook tắt query khi hidden, refetch khi visible, cleanup khi unmount; AbortSignal đến HTTP client.
- HTTP tests dùng JWT/role thật và PostgreSQL riêng. Database-boundary test kiểm tra không chọn cột cấm; UI/hook dùng mock HTTP và fake browser/clock.
- Quy tắc và BDD xem [spec.md](spec.md). retryCount hiển thị dữ liệu đã lưu, không suy đoán retry provider.
- List/count và detail/node logs đọc trong transaction RepeatableRead để có snapshot nhất quán. Admin read projection là boundary đọc dùng chung database đã có trong thiết kế Admin; runtime vẫn thuộc Execution module. Hàm chuẩn hóa mã lỗi được export qua public entry point của Execution.
- Query offset vượt giới hạn signed 32-bit của Prisma bị từ chối với 400; tránh truy vấn phân trang quá lớn gây lỗi database.
