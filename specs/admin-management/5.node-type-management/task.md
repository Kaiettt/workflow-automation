# Checklist: Quản lý Loại Node (Node Type Management)

Status: ready-for-agent (P1)

- [ ] G5.1 **Database Migration**: Bổ sung model `NodeTypePolicy` vào `monolith-backend/prisma/schema.prisma` và tạo migration cơ sở dữ liệu.
- [ ] G5.2 **Catalog Sync Protection**: Sửa `PackageCatalogSync` (`monolith-backend/libs/node-library/src/infrastructure/package-catalog.sync.ts`) để chỉ upsert bảng `node_type_definitions`, không chạm vào `node_type_policies`.
- [ ] G5.3 **Node Type Policy Port & Command**:
  - Tạo `ChangeNodeTypeStatusCommand` trong `libs/node-library/src/application/commands/`.
  - Triển khai handler: Lấy advisory lock `7261103`, kiểm tra `expectedRevision`, no-op, cập nhật cờ, tăng revision và ghi `admin_audit_events` (`NODE_TYPE_STATUS_CHANGED`) atomic.
- [ ] G5.4 **Designer Palette Filter Gate**:
  - Cập nhật `NodeTypesController.getNodeTypes()` kết hợp truy vấn `node_type_policies` để lọc bỏ các node có `isCatalogVisible === false`.
- [ ] G5.5 **Runtime Execution Enforcement Gate**:
  - Cập nhật `NodeRunner.run()` trong `monolith-backend/libs/execution/src/application/services/node-runner.ts`.
  - Nếu `isExecutionAllowed === false`: Dừng thực thi node, ghi nhận log `FAILED` với mã lỗi `NODE_TYPE_DISABLED`.
- [ ] G5.6 **Admin Projection & Query**:
  - Bổ sung `AdminReadPort.nodeTypes()` và `AdminReadPort.nodeType(key)` tính toán `publishedWorkflowCount` và `draftWorkflowCount`.
  - Thêm endpoint `GET /api/admin/node-types`, `GET /api/admin/node-types/:key`, `PATCH /api/admin/node-types/:key/status` trong `AdminController`.
- [ ] G5.7 **Frontend Components & Page**:
  - Cập nhật `admin.types.ts` và `admin.service.ts` với node type DTOs và API methods.
  - Tạo hook `useAdminNodeTypes.ts`.
  - Tạo `NodeTypeTable.tsx`, `NodeTypeStatusDialog.tsx`, `NodeTypeDetailCard.tsx`.
  - Tạo `NodeTypesPage.tsx` có bộ lọc category, tìm kiếm, phân trang và dialog điều chỉnh trạng thái.
- [ ] G5.8 **Kiểm thử G5**: Viết unit & integration tests cho AC-NM-01 đến AC-NM-05 (palette visibility, runtime execution blocked, workflow backward compatibility).
