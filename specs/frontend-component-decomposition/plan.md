# Implementation Plan: Frontend Component Decomposition

## Overview
Decompose large frontend files (`VersionDetailPage.tsx`, `WorkflowCanvasPreview.tsx`, `WorkflowListPage.tsx`) into modular, testable components and custom hooks without changing visual appearance or user behavior.

---

## Phase 1: Shared Execution Canvas Node & Version Canvas Subcomponents

### Tasks
1. Create `frontend/src/features/workflow/components/canvas/ExecutionCanvasNode.tsx`
   - Merge `RunnerNodeComponent` and `PreviewNodeComponent` interfaces and styling.
   - Support icons: `webhook`, `filter`, `database`, `mail`, `ai`, `action`.
   - Support states: `idle`, `running`, `success`, `failed`, `skipped`.
2. Extract subcomponents for `VersionDetailPage`:
   - `frontend/src/features/workflow/components/version-detail/ExecutionControlBar.tsx`
   - `frontend/src/features/workflow/components/version-detail/ExecutionNodeLogTable.tsx`
   - `frontend/src/features/workflow/components/version-detail/NodeLogDetailAccordion.tsx`
   - `frontend/src/features/workflow/components/version-detail/VersionStructureCard.tsx`
3. Add unit tests for `ExecutionCanvasNode.test.tsx` and `ExecutionNodeLogTable.test.tsx`.

---

## Phase 2: Extract Custom Hooks (`useExecutionMonitor` & `useDraftAutoSave`)

### Tasks
1. Create `frontend/src/features/workflow/hooks/useExecutionMonitor.ts`
   - Encapsulate SSE subscription logic, heartbeat tracking, and cache updates.
   - Provide unit tests mocking `executionService.subscribeExecution`.
2. Create `frontend/src/features/workflow/hooks/useDraftAutoSave.ts`
   - Encapsulate `setTimeout` debounce timer, cleanup, and forced synchronous save on publish.
   - Add unit tests verifying debounced trigger behavior with fake timers.

---

## Phase 3: Refactor Pages (`VersionDetailPage`, `WorkflowListPage`, `DesignerPage`)

### Tasks
1. Refactor `VersionDetailPage.tsx`:
   - Replace embedded node components, table renderers, and stream event hooks with the extracted components and `useExecutionMonitor`.
   - Verify line count drops from ~950 lines to < 180 lines.
2. Refactor `WorkflowListPage.tsx`:
   - Extract `RenameWorkflowDialog.tsx` and `DeleteWorkflowDialog.tsx` into `components/dialogs/`.
   - Replace raw modal state sprawl with clean dialog components.
3. Refactor `WorkflowCanvasPreview.tsx`:
   - Replace inline node component with `ExecutionCanvasNode`.
   - Extract simulation timer orchestrator into `usePreviewSimulation` hook.
4. Run full frontend Vitest test suite (`npm test`).

