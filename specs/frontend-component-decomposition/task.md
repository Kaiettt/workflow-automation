# Task List: Frontend Component Decomposition

- [x] **Phase 1: Shared Execution Canvas Node & Version Subcomponents**
  - [x] 1.1 Create `frontend/src/features/workflow/components/canvas/ExecutionCanvasNode.tsx` (unifying `RunnerNodeComponent` & `PreviewNodeComponent`).
  - [x] 1.2 Create unit tests in `frontend/src/features/workflow/components/canvas/ExecutionCanvasNode.test.tsx`.
  - [x] 1.3 Create subcomponents under `frontend/src/features/workflow/components/version-detail/`:
    - [x] `VersionHeader.tsx`
    - [x] `ExecutionControlBar.tsx`
    - [x] `ExecutionResultStats.tsx`
    - [x] `NodeLogDetailAccordion.tsx`
    - [x] `ExecutionNodeLogTable.tsx`
    - [x] `VersionStructureCard.tsx`
    - [x] `VersionCanvas.tsx`
  - [x] 1.4 Create unit tests in `frontend/src/features/workflow/components/version-detail/ExecutionNodeLogTable.test.tsx`.

- [x] **Phase 2: Custom Hooks Extraction (`useExecutionMonitor` & `useDraftAutoSave`)**
  - [x] 2.1 Create `frontend/src/features/workflow/hooks/useExecutionMonitor.ts`.
  - [x] 2.2 Create unit tests in `frontend/src/features/workflow/hooks/useExecutionMonitor.test.tsx`.
  - [x] 2.3 Create `frontend/src/features/workflow/hooks/useDraftAutoSave.ts`.
  - [x] 2.4 Create unit tests in `frontend/src/features/workflow/hooks/useDraftAutoSave.test.ts`.

- [x] **Phase 3: Dialog & Table Extraction for `WorkflowListPage`**
  - [x] 3.1 Create `frontend/src/features/workflow/components/dialogs/DeleteWorkflowDialog.tsx`.
  - [x] 3.2 Create `frontend/src/features/workflow/components/workflow-list/WorkflowTable.tsx`.
  - [x] 3.3 Refactor `frontend/src/features/workflow/pages/WorkflowListPage.tsx` to use extracted dialog and table components (<180 lines).
  - [x] 3.4 Verify `WorkflowListPage.test.tsx` passes with 100% success rate.

- [x] **Phase 4: Refactor `VersionDetailPage` and `DesignerPage`**
  - [x] 4.1 Refactor `frontend/src/features/workflow/pages/VersionDetailPage.tsx` using `useExecutionMonitor` and extracted subcomponents (<180 lines).
  - [x] 4.2 Refactor `frontend/src/features/workflow/pages/DesignerPage.tsx` using `useDraftAutoSave` to isolate auto-save debounce logic (<300 lines).
  - [x] 4.3 Verify `DesignerPage.test.tsx` passes.

- [x] **Phase 5: Home Preview Decomposition (`WorkflowCanvasPreview`)**
  - [x] 5.1 Create `frontend/src/features/home/hooks/usePreviewSimulation.ts`.
  - [x] 5.2 Refactor `frontend/src/features/home/components/WorkflowCanvasPreview.tsx` to use `ExecutionCanvasNode` and `usePreviewSimulation` (<200 lines).

- [x] **Phase 6: Full Verification & Compact Summary**
  - [x] 6.1 Run full frontend test suite: `npm test --prefix frontend`.
  - [x] 6.2 Run frontend linter: `npm run lint --prefix frontend`.
  - [x] 6.3 Create compact summary `specs/frontend-component-decomposition/compact.md`.
  - [x] 6.4 Advise user to run `/compact`.
