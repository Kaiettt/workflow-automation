# Thiết kế: Quản lý Tài khoản (User Management)

Status: completed (PR #39)

## 1. Ranh giới Module và Phân tầng CQRS

- **Presentation**: `monolith-backend/libs/admin/src/presentation/admin.controller.ts`:
  - `GET /api/admin/users` -> gọi `AdminReadQuery({ kind: 'users', filter })`.
  - `GET /api/admin/users/:id` -> gọi `AdminReadQuery({ kind: 'user', id })`.
  - `GET /api/admin/users/:id/workflows` -> gọi `AdminReadQuery({ kind: 'workflows', id, filter })`.
  - `PATCH /api/admin/users/:id/active` -> gọi `ManageAccountCommand({ targetId, isActive, reason, expectedRevision, actorId })`.
  - `PATCH /api/admin/users/:id/role` -> gọi `ManageAccountCommand({ targetId, role, reason, expectedRevision, actorId })`.
- **Domain & Application**:
  - `libs/auth/src/application/commands/manage-account.command.ts`: Nhận command từ Admin controller.
  - Handler trong `libs/auth` xử lý toàn bộ logic kiểm tra nghiệp vụ, advisory lock và cập nhật database.
- **Query Projection**:
  - `PrismaAdminRead` trong `libs/admin/src/infrastructure/prisma-admin-read.ts`: Thực hiện các câu lệnh Prisma `findMany` và `count` với whitelist tĩnh `userSelect`.

## 2. Hợp đồng API và DTO Whitelist

```typescript
// ActiveDto
export class ActiveDto {
  @IsBoolean()
  isActive!: boolean;

  @IsString()
  @Length(5, 500)
  reason!: string;

  @IsInt()
  @Min(0)
  expectedRevision!: number;
}

// RoleDto
export class RoleDto {
  @IsEnum(['CLIENT', 'ADMIN'])
  role!: 'CLIENT' | 'ADMIN';

  @IsString()
  @Length(5, 500)
  reason!: string;

  @IsInt()
  @Min(0)
  expectedRevision!: number;
}
```

## 3. Thiết kế Transaction và Bảo vệ Invariants (Advisory Lock)

Mỗi thao tác thay đổi trạng thái tài khoản hoặc vai trò đều thực thi trong một PostgreSQL Transaction:
```sql
-- 1. Lấy transaction advisory lock dùng chung cho nghiệp vụ User Admin
SELECT pg_advisory_xact_lock(7261101);

-- 2. Khóa dòng actor và dòng target theo thứ tự ID ổn định (chống deadlock)
SELECT id, role, is_active FROM users WHERE id IN ($actorId, $targetId) ORDER BY id FOR UPDATE;

-- 3. Kiểm tra tính bất biến:
--    a. actor.id === target.id -> SELF_ADMIN_CHANGE_FORBIDDEN (409)
--    b. target.revision !== expectedRevision -> STALE_REVISION (409)
--    c. Nếu target.role === 'ADMIN' && (newRole === 'CLIENT' || newActive === false):
--       Đếm số lượng Admin active còn lại trong hệ thống.
--       Nếu count <= 1 -> LAST_ACTIVE_ADMIN (409)
--    d. Nếu target.is_active === false && newRole === 'ADMIN' -> TARGET_USER_INACTIVE (409)

-- 4. Cập nhật target:
UPDATE users SET is_active = $newActive, role = $newRole, revision = revision + 1, session_version = session_version + 1 WHERE id = $targetId;

-- 5. Ghi nhận outbox thu hồi phiên và audit event trong cùng transaction:
INSERT INTO session_revocations (user_id, session_version) VALUES ($targetId, $newSessionVersion);
INSERT INTO admin_audit_events (actor_type, actor_id, action, target_type, target_id, reason, before, after) VALUES ...;
```

## 4. Tác động Runtime: Execution Claim Gate
Trong `monolith-backend/libs/execution/src/infrastructure/queue/execution.processor.ts`:
- Khi worker claim một execution từ hàng đợi BullMQ:
  ```typescript
  const owner = await tx.user.findUnique({
    where: { id: execution.workflow.ownerId },
    select: { isActive: true },
  });
  if (!owner || !owner.isActive) {
    await tx.execution.update({
      where: { id: execution.id },
      data: {
        status: ExecutionStatus.CANCELLED,
        cancellationReason: 'OWNER_SUSPENDED',
        finishedAt: new Date(),
      },
    });
    return; // Dừng, không gọi NodeRunner
  }
  ```

## 5. Thiết kế Giao diện Frontend

- `UsersPage.tsx`: Bảng danh sách tài khoản, thanh tìm kiếm tên/email, dropdown lọc role (`CLIENT`, `ADMIN`), dropdown lọc trạng thái, phân trang.
- `UserDetailPage.tsx`:
  - Card thông tin hồ sơ: Họ tên, email, ngày tạo, revision, badge trạng thái, badge role.
  - Card thống kê tài nguyên: Số workflow, số credential, tổng số lượt execution đã chạy.
  - Card danh sách workflow tóm tắt của user (có phân trang).
  - Nút bấm hành động: "Khóa tài khoản" / "Mở khóa tài khoản" và "Đổi vai trò".
- `AccountChangeDialog.tsx`: Dialog xác nhận bắt buộc nhập lý do, hiển thị tóm tắt tác động trước/sau. Khi nhận lỗi `409`, tự động thông báo và tải lại dữ liệu mới nhất.
