# Thiết kế: Dashboard Vận hành (Admin Dashboard)

Status: completed (PR #39)

## 1. Ranh giới Module và Phân tầng Kiến trúc

- **Presentation**: `AdminController.dashboard(@Query() query: DashboardDto)`:
  - Xác thực khoảng thời gian: `from < to`, khoảng cách tối đa 90 ngày (`90 * 86400000 ms`).
  - Kiểm tra tính hợp lệ của `timezone` qua `Intl.DateTimeFormat`.
  - Chuyển tiếp query sang `QueryBus`.
- **Query Projection**:
  - `AdminReadPort.dashboard(filter: DashboardFilter)`
  - Triển khai tại `PrismaAdminRead.dashboard()` trong `libs/admin/src/infrastructure/prisma-admin-read.ts`.
  - Thực thi toàn bộ việc đếm và aggregate phía server trong một database transaction mức cô lập `Repeatable Read` để đảm bảo tính nhất quán của số liệu.

## 2. Hợp đồng API và DTO

### Endpoint
`GET /api/admin/dashboard?from=...&to=...&timezone=...`

### Query DTO
```typescript
export class DashboardDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsString()
  @IsNotEmpty()
  timezone!: string;
}
```

### Response DTO
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 120,
      "clientsActive": 110,
      "clientsInactive": 8,
      "adminsActive": 2
    },
    "workflows": {
      "total": 45,
      "active": 30,
      "DRAFT": 10,
      "PUBLISHED": 32,
      "ARCHIVED": 3
    },
    "executions": {
      "total": 1500,
      "QUEUED": 5,
      "RUNNING": 10,
      "SUCCESS": 1350,
      "FAILED": 100,
      "CANCELLED": 35,
      "successRate": 93.1
    },
    "trend": [
      { "day": "2026-11-08", "status": "SUCCESS", "count": 180 },
      { "day": "2026-11-08", "status": "FAILED", "count": 12 }
    ],
    "errors": [
      { "errorCode": "CONNECTOR_TIMEOUT", "count": 65 },
      { "errorCode": "RATE_LIMIT_EXCEEDED", "count": 25 },
      { "errorCode": "UNCLASSIFIED_ERROR", "count": 10 }
    ],
    "range": {
      "from": "2026-11-08T00:00:00.000Z",
      "to": "2026-11-15T00:00:00.000Z",
      "timezone": "Asia/Ho_Chi_Minh"
    },
    "updatedAt": "2026-11-15T08:00:00.000Z"
  }
}
```

## 3. Câu lệnh Truy vấn Tổng hợp Cơ sở Dữ liệu

```typescript
const [accounts, workflowCounts, workflowActive, executionCounts, errors, trend] = await tx.$transaction([
  // 1. Phân loại tài khoản
  tx.user.groupBy({ by: ['role', 'isActive'], _count: true }),
  // 2. Phân loại workflow theo trạng thái
  tx.workflow.groupBy({ by: ['status'], _count: true }),
  // 3. Đếm workflow đang bật active
  tx.workflow.count({ where: { active: true } }),
  // 4. Phân loại execution theo trạng thái trong khoảng [from, to)
  tx.execution.groupBy({ by: ['status'], where: { queuedAt: { gte: from, lt: to } }, _count: true }),
  // 5. Gom nhóm lỗi FAILED theo mã an toàn
  tx.execution.groupBy({ by: ['errorCode'], where: { queuedAt: { gte: from, lt: to }, status: 'FAILED' }, _count: true }),
  // 6. Xu hướng ngày theo timezone
  tx.$queryRaw`
    SELECT to_char(queued_at AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day,
           status::text,
           COUNT(*)::int AS count
    FROM executions
    WHERE queued_at >= ${from} AND queued_at < ${to}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `
]);
```

## 4. Thiết kế Giao diện Frontend

- `DashboardPage.tsx`: Màn hình chính Dashboard.
  - Header: Tiêu đề, thời điểm cập nhật lần cuối, nút làm mới (refresh).
  - `DashboardRangeFilter.tsx`: Bộ chọn nhanh 24h, 7 ngày, 30 ngày hoặc custom date picker.
  - Hàng thẻ Metrics:
    - `MetricCard.tsx`: Tổng Users (Client Active/Inactive, Admin Active).
    - `MetricCard.tsx`: Tổng Workflows (Active, Draft, Published, Archived).
    - `MetricCard.tsx`: Tổng Executions & Tỷ lệ thành công.
  - `ExecutionPanels.tsx`:
    - Biểu đồ xu hướng (Recharts / SVG): Hiển thị số lượng execution theo ngày.
    - Bảng phân nhóm lỗi: Danh sách mã lỗi an toàn và số lượng phát sinh.
- Kiểm soát Polling: Sử dụng hook `useAdmin` với `refetchInterval: document.visibilityState === 'visible' ? 30000 : false`.
