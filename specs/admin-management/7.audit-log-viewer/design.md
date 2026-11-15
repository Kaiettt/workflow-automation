# Thiết kế: Trình tra cứu Nhật ký Quản trị (Audit Log Viewer)

Status: ready-for-agent (P1)

## 1. Ranh giới Module và Phân tầng Kiến trúc

- **Presentation**: `AdminController` trong `libs/admin/src/presentation`:
  - `GET /api/admin/audit-events` -> `AdminReadQuery({ kind: 'auditEvents', filter })`
  - `GET /api/admin/audit-events/:id` -> `AdminReadQuery({ kind: 'auditEvent', id })`
- **Query Projection**:
  - `AdminReadPort.auditEvents(filter: AdminAuditFilter)`
  - `AdminReadPort.auditEvent(id: string)`
  - Triển khai trong `PrismaAdminRead` (`libs/admin/src/infrastructure/prisma-admin-read.ts`):
    - Truy vấn bảng `admin_audit_events`.
    - Join với bảng `users` để lấy `name`, `email` của `actorId`.
- **Infrastructure & Persistence**:
  - Model `AdminAuditEvent` trong `prisma/schema.prisma` (đã có từ P0).
  - Chỉ mục tối ưu: `@@index([createdAt, id])` và `@@index([targetId, createdAt])`.

## 2. Hợp đồng API và DTO Whitelist

### DTO Bộ lọc Audit
```typescript
export class AdminAuditFilterDto {
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
  actorId?: string;

  @IsOptional()
  @IsEnum(['ADMIN', 'SYSTEM'])
  actorType?: 'ADMIN' | 'SYSTEM';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsEnum(['USER', 'CONNECTOR', 'NODE_TYPE'])
  targetType?: 'USER' | 'CONNECTOR' | 'NODE_TYPE';

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
```

### Response DTO Chi tiết Audit Event
```typescript
export interface AdminAuditEventDetailDto {
  id: string;
  actorType: 'ADMIN' | 'SYSTEM';
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  targetType: 'USER' | 'CONNECTOR' | 'NODE_TYPE';
  targetId: string;
  targetName?: string | null;
  reason: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  createdAt: string;
}
```

## 3. Thiết kế Giao diện Frontend

- `AuditEventsPage.tsx`:
  - `AuditEventFilterBar.tsx`:
    - Dropdown chọn `Action` (`USER_SUSPENDED`, `USER_REACTIVATED`, `USER_ROLE_CHANGED`, `ADMIN_BOOTSTRAPPED`, `CONNECTOR_POLICY_CHANGED`, `NODE_TYPE_STATUS_CHANGED`).
    - Dropdown chọn `Target Type` (All, User, Connector, Node Type).
    - Dropdown chọn `Actor Type` (All, Admin, System).
    - Bộ chọn thời gian (Quick 24h, 7d, 30d, custom).
  - `AuditEventTable.tsx`:
    - Cột: Thời điểm (UTC & Local), Actor (Tên/Email hoặc SYSTEM badge), Hành động (Badge theo màu), Loại tài nguyên, ID tài nguyên, Lý do tóm tắt, Nút "Xem chi tiết".
- `AuditDiffDialog.tsx`:
  - Header: Tên hành động, Actor, Thời gian, Target ID.
  - Khối lý do Admin: Hiển thị đầy đủ chuỗi reason trong callout box.
  - Bảng đối chiếu Diff trực quan:
    - Cột 1: Tên thuộc tính (Field name).
    - Cột 2: Giá trị trước đó (Before) - highlight đỏ nhạt nếu bị xóa/tắt.
    - Cột 3: Giá trị sau đó (After) - highlight xanh nhạt nếu được cập nhật/bật.
- Hook: `useAdminAudit.ts` sử dụng TanStack Query với query keys `['admin', 'audit-events', filters]`.
