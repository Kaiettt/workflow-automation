# Implementation Tasks: Workflow Version Restore

## 1. Backend (NestJS, Prisma, CQRS)

- [x] **Domain & Shared Types**
  - [x] Khai báo Enum `RestoreStrategy` (`PUBLISH_THEN_RESTORE`, `BACKUP_THEN_RESTORE`, `OVERWRITE`)
  - [x] Khai báo interface / domain model cho `RestoreResult`
- [x] **Presentation Layer**
  - [x] Tạo `restore-version.dto.ts` (validate input bằng `class-validator`)
  - [x] Cập nhật `workflows.controller.ts`:
    - [x] `POST /api/workflows/:id/versions/:versionId/restore`
    - [x] `GET /api/workflows/:id/draft/status`
    - [x] `GET /api/workflows/:id/versions`
    - [x] `GET /api/workflows/:id/versions/:versionId`
- [x] **Application Layer (CQRS)**
  - [x] Tạo `restore-version.command.ts`
  - [x] Tạo `restore-version.handler.ts` (xử lý logic điều phối và transaction)
  - [x] Tạo `get-draft-status.handler.ts` (Query & Handler kiểm tra unpublished changes)
- [x] **Infrastructure Layer**
  - [x] Triển khai transaction an toàn với `this.prisma.$transaction`
- [x] **Module Assembly**
  - [x] Đăng ký Command/Query handlers và Controller vào `DesignerModule`

---

## 2. Frontend (React 19, shadcn/ui, TanStack Query)

- [x] **Prerequisites & Package Setup**
  - [x] Cài đặt `@tanstack/react-query` và thiết lập `QueryClientProvider` trong `main.tsx`
- [x] **shadcn/ui Components Installation**
  - [x] Cài đặt và cấu hình: `dialog`, `radio-group`, `alert`, `badge`, `button`
- [x] **API Layer**
  - [x] Tạo `workflow-version.api.ts` với hàm `restoreVersion`, `getDraftStatus`, `getVersions`, `getVersion`
  - [x] Tạo `workflow-version.service.ts`
- [x] **Hooks Layer**
  - [x] Tạo `useWorkflowVersions.ts` với `useWorkflowVersions`, `useDraftStatus`, `useRestoreVersion` (TanStack Query)
- [x] **UI Components Layer**
  - [x] Tạo `RestoreConflictDialog.tsx` với 3 lựa chọn trực quan
  - [x] Tạo `VersionHistoryDialog.tsx` hiển thị danh sách phiên bản và nút Khôi phục
  - [x] Tích hợp nút Lịch sử phiên bản vào thanh công cụ `DesignerLayout.tsx` và nạp lại graph trên canvas `DesignerPage.tsx`

---

## 3. Kiểm thử & Đảm bảo chất lượng (QA & Verification)

- [x] **Kiểm thử kịch bản 1 (`OVERWRITE`):**
  - [x] Đã kiểm thử thành công qua suite e2e `restore-version.e2e-spec.ts`.
- [x] **Kiểm thử kịch bản 2 (`PUBLISH_THEN_RESTORE`):**
  - [x] Tạo thành công Version mới (v3) từ draft và khôi phục v1 vào draft.
- [x] **Kiểm thử kịch bản 3 (`BACKUP_THEN_RESTORE`):**
  - [x] Tạo thành công 1 Workflow backup riêng và nạp v2 vào draft.
- [x] **Kiểm thử biên & Trạng thái Draft (`draft/status`):**
  - [x] Kiểm tra chính xác trạng thái `hasUnpublishedChanges: true/false`.
- [x] **Kiểm thử Build Frontend & Backend:**
  - [x] `npm run build` frontend và `npx eslint` backend đều vượt qua với 0 lỗi.
