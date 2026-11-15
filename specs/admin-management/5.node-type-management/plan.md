# Kế hoạch Triển khai: Quản lý Loại Node (Node Type Management)

Status: ready-for-agent (P1)

## 1. Mục tiêu và Phạm vi
Giai đoạn G5 triển khai tính năng quản lý danh mục Node Types cho Admin, hỗ trợ kiểm soát độc lập giữa hiển thị catalog và quyền thực thi runtime, bảo toàn workflow cũ.

## 2. Kế hoạch Triển khai Chi tiết

### Bước 1: Database Migration & Schema
- Bổ sung model `NodeTypePolicy` vào `prisma/schema.prisma`.
- Tạo migration cơ sở dữ liệu và chạy `prisma generate`.

### Bước 2: Tách biệt Quá trình Đồng bộ Catalog (`PackageCatalogSync`)
- Cập nhật hàm `sync()` trong `libs/node-library/src/infrastructure/package-catalog.sync.ts` để chỉ upsert vào `node_type_definitions`, không ghi đè bảng `node_type_policies`.

### Bước 3: Backend Application & Commands
- Tạo `ChangeNodeTypeStatusCommand` trong `libs/node-library/src/application/commands/`.
- Cài đặt handler sử dụng advisory lock `7261103`, kiểm tra `expectedRevision`, cập nhật chính sách, tăng revision và ghi `admin_audit_events` (`NODE_TYPE_STATUS_CHANGED`).

### Bước 4: Palette Filter Gate & Runtime Execution Gate
- Cập nhật `NodeTypesController.getNodeTypes()` để chỉ trả về các node có `isCatalogVisible !== false`.
- Cập nhật `NodeRunner.run()` trong `libs/execution` kiểm tra `isExecutionAllowed`; nếu cấm chạy, ghi log `FAILED` với `errorCode = 'NODE_TYPE_DISABLED'`.

### Bước 5: Backend Query Projection
- Mở rộng `AdminReadPort` với `.nodeTypes(filter)` và `.nodeType(key)`.
- Triển khai trong `PrismaAdminRead`:
  - Join `node_type_definitions` với `node_type_policies`.
  - Đếm `publishedWorkflowCount` và `draftWorkflowCount`.

### Bước 6: Presentation Endpoints
- Thêm `GET /api/admin/node-types`, `GET /api/admin/node-types/:key`, `PATCH /api/admin/node-types/:key/status` trong `AdminController`.
- Gắn guard `@AdminBodyFields('isCatalogVisible', 'isExecutionAllowed')`.

### Bước 7: Frontend Development
- Cập nhật `admin.types.ts` và `admin.service.ts`.
- Xây dựng hook `useAdminNodeTypes.ts`.
- Tạo `NodeTypeTable.tsx`, `NodeTypeStatusDialog.tsx`, `NodeTypeDetailCard.tsx`.
- Tạo trang `NodeTypesPage.tsx`.

### Bước 8: Kiểm thử Tự động
- Viết unit test cho `ChangeNodeTypeStatusCommand`.
- Viết integration test cho palette filter và runtime execution blocker.
- Viết test xác nhận `PackageCatalogSync` không ghi đè chính sách.
