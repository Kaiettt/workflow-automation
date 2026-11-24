# Thiết kế: Trình tra cứu Nhật ký Quản trị (Audit Log Viewer)

Status: implemented (P1, 2026-11-24)

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
export class AdminAuditFilterDto extends AdminTimeRangeDto {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsIn(['ADMIN', 'SYSTEM'])
  actorType?: 'ADMIN' | 'SYSTEM';

  @IsOptional()
  @IsIn(ADMIN_AUDIT_ACTIONS)
  action?: AdminAuditAction;

  @IsOptional()
  @IsIn(['USER', 'CONNECTOR', 'NODE_TYPE'])
  targetType?: 'USER' | 'CONNECTOR' | 'NODE_TYPE';

  @IsOptional()
  @IsUUID()
  targetId?: string;

  // from/to và numeric pagination kế thừa từ AdminTimeRangeDto/PageDto.
}
```

### Response DTO Chi tiết Audit Event
```typescript
export interface AdminAuditEventDetailDto {
  id: string;
  actorType: 'ADMIN' | 'SYSTEM' | 'UNKNOWN';
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: AdminAuditAction | 'UNKNOWN_ACTION';
  targetType: 'USER' | 'CONNECTOR' | 'NODE_TYPE' | 'UNKNOWN';
  targetId: string;
  targetName: string | null;
  reason: string;
  before: AdminAuditSnapshot;
  after: AdminAuditSnapshot;
  createdAt: string;
}
```

## 3. Thiết kế Giao diện Frontend

- `AuditEventsPage.tsx`:
  - `AuditEventFilterBar.tsx`:
    - Dropdown chọn `Action` (`USER_SUSPENDED`, `USER_REACTIVATED`, `USER_ROLE_CHANGED`, `ADMIN_BOOTSTRAPPED`, `CONNECTOR_POLICY_CHANGED`, `NODE_TYPE_STATUS_CHANGED`).
    - Dropdown chọn `Target Type` (All, User, Connector, Node Type).
    - Dropdown chọn `Actor Type` (All, Admin, System).
    - Picker tìm actor bằng tên/email và ô nhập actorId UUID khi cần; ô targetId UUID.
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

## 4. Thiết kế cụ thể và ranh giới kiểm thử

- Schema/index hiện có được tái sử dụng; không thêm migration. targetId là UUID cho cả ba target types.
- ReadPort có types cụ thể cho metadata/page/detail. Prisma selects tĩnh; list/count/detail và lookup cùng RepeatableRead transaction.
- actorId không có Prisma relation: lookup actors/users, connectors và node types theo batch, không N+1; select metadata an toàn, không credentials/definition. Target/actor thiếu trả tên null.
- Snapshot projector tại application layer nhận unknown, validate scalar theo whitelist action/target; bỏ unknown fields, không truy vấn đối tượng nghiệp vụ để dựng diff lịch sử.
- Role/active/revision của user cũ không được backfill. Node key chỉ là metadata, không thuộc bảng diff trạng thái.
- UI sử dụng shadcn table/dialog/badge, shared range/pagination/error components. Visibility lifecycle tái sử dụng từ G6 trong feature Admin.
- Public seams và BDD chi tiết ở [spec.md](spec.md). G7 test mới chứng minh connector rollback thật; regression account/node/bootstrap đã có được chạy lại.

API list không trả before/after. API detail và UI chỉ hỗ trợ sáu state fields: role, isActive, revision, allowNewCredentials, isCatalogVisible, isExecutionAllowed. Đối với action không nhận diện hoặc action/targetType không khớp, projector trả snapshot rỗng. Revision thiếu giữ nguyên missing; null đã ghi được giữ lại; các giá trị sai kiểu bị loại.

UI dùng shared useAdminPageVisibility với G6. G6 và G7 tái sử dụng AdminTimeRangeDto và adminListRange cho cùng chính sách pagination/time range; tests G6 được giữ làm regression.
