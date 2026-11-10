# Refactoring Specification: Frontend Component Decomposition

> **Category:** Frontend Readability & Maintainability  
> **Status:** Proposed  
> **Target Scope:** `frontend/src/features/workflow/` and `frontend/src/features/home/`

---

## 1. Problem Statement & Motivation

Several core frontend pages and components have evolved into **"God Components"** (files exceeding 500–950 lines of code) that violate the single responsibility principle and the project guidelines (*"Components should have one responsibility and ideally be under 200 lines"*):

1. **`VersionDetailPage.tsx` (951 lines, 40 KB):**
   - Combines 7 distinct concerns into a single file:
     - React Flow canvas setup and custom node definitions (`RunnerNodeComponent`).
     - Live execution subscription and status badge display.
     - Execution history list drawer integration.
     - Node execution log table with expandable accordion JSON viewers for input/output.
     - Webhook trigger metadata display and test panels.
     - Read-only snapshot frozen node tree representation.
     - Interactive execution trigger buttons and error banners.
   - High cognitive overhead: any change to log formatting, canvas layouts, or execution triggers requires navigating and altering a 1,000-line monolithic file.

2. **`WorkflowCanvasPreview.tsx` (620 lines, 24 KB):**
   - Implements a duplicated `PreviewNodeComponent` that mirrors 80% of `RunnerNodeComponent` from `VersionDetailPage.tsx`.
   - Embeds a hardcoded 10-step timer orchestration (`setTimeout` chain spanning lines 240–400) directly in the UI component.
   - Embeds tabbed console drawers, custom SVG graphics, and mock payloads in the same file.

3. **`WorkflowListPage.tsx` (351 lines, 16 KB):**
   - Manages **9 separate `useState` hooks** for dialog modals, rename fields, deleting targets, and template creation states.
   - Directly embeds modal dialog components (Delete Dialog, Rename Dialog) and inline table structures inside the page container.

4. **`DesignerPage.tsx` (373 lines, 13 KB):**
   - Directly manipulates DOM classes (`updateValidationHighlights`) across nodes.
   - Inlines node data change handlers with domain logic (e.g. automatically removing edges when switch rules change).
   - Inlines debounced auto-save timers using `useRef` directly in the component.

---

## 2. Goals & Non-Goals

### Goals
- **Decompose `VersionDetailPage.tsx`** into modular, single-responsibility components with `< 200 lines` each.
- **Unify custom visualizer node components** between `VersionDetailPage` and `WorkflowCanvasPreview` into a shared, reusable `ExecutionCanvasNode`.
- **Extract custom hooks** for execution monitoring (`useExecutionMonitor`) and debounced draft auto-saving (`useDraftAutoSave`).
- **Separate dialog components** from `WorkflowListPage` (`RenameWorkflowDialog`, `DeleteWorkflowDialog`) to simplify state management and improve testability.
- **Isolate presentation from side-effects**, ensuring components focus strictly on rendering and user interaction.

### Non-Goals
- Altering the visual design or UX of the existing designer, version details, or preview canvas.
- Changing backend API contracts or WebSocket/SSE wire protocols.

---

## 3. Architecture & Target Component Hierarchy

### 3.1 `VersionDetailPage` Target Architecture

```
frontend/src/features/workflow/pages/VersionDetailPage.tsx (< 150 lines)
│
├── components/version-detail/
│   ├── VersionHeader.tsx                # Breadcrumb, version title, trigger button, status
│   ├── VersionCanvas.tsx                # ReactFlow canvas with read-only visualization
│   │   └── ExecutionCanvasNode.tsx      # Shared custom node with status indicator & ports
│   ├── ExecutionControlBar.tsx          # Execution status pill, duration counter, rerun actions
│   ├── ExecutionHistoryDrawer.tsx       # Slide-out or collapsible run history list
│   ├── ExecutionNodeLogTable.tsx        # Node execution logs table (columns: node, status, duration)
│   │   └── NodeLogDetailAccordion.tsx   # JSON viewer for input/output payloads & errors
│   └── VersionStructureCard.tsx         # Static frozen node & edge summary cards
│
└── hooks/
    └── useExecutionMonitor.ts           # Encapsulates SSE subscription, cache patching, and status polling
```

### 3.2 Target Directory Structure

```
frontend/src/features/workflow/
├── components/
│   ├── canvas/
│   │   ├── BaseNode.tsx
│   │   └── ExecutionCanvasNode.tsx       <-- Shared between VersionDetail & Home Preview
│   ├── dialogs/
│   │   ├── RenameWorkflowDialog.tsx      <-- Extracted from WorkflowListPage
│   │   ├── DeleteWorkflowDialog.tsx      <-- Extracted from WorkflowListPage
│   │   ├── VersionHistoryDialog.tsx
│   │   └── PublishValidationDialog.tsx
│   └── version-detail/
│       ├── VersionHeader.tsx
│       ├── VersionCanvas.tsx
│       ├── ExecutionControlBar.tsx
│       ├── ExecutionNodeLogTable.tsx
│       ├── NodeLogDetailAccordion.tsx
│       └── VersionStructureCard.tsx
├── hooks/
    ├── useDraftAutoSave.ts               <-- Extracted from DesignerPage
    ├── useExecutionMonitor.ts            <-- Extracted from VersionDetailPage
    └── ...
```

---

## 4. Detailed Component & Hook Specifications

### 4.1 `useExecutionMonitor.ts`
Encapsulates real-time SSE stream events and fallback polling:

```typescript
export interface UseExecutionMonitorOptions {
  workflowId: string;
  versionId: string;
  selectedExecutionId?: string;
  onExecutionCompleted?: (result: ExecutionResult) => void;
}

export interface UseExecutionMonitorReturn {
  activeExecution: ExecutionResult | null;
  connectionState: ExecutionConnectionState;
  nodeStates: Map<string, NodeExecutionState>;
  isExecuting: boolean;
  startExecution: () => Promise<void>;
}
```

**Responsibilities:**
- Connects to `executionService.subscribeExecution`.
- Merges incremental node log stream events into local query cache via `applyExecutionStreamEvent`.
- Automatically disconnects on unmount or terminal execution state (`SUCCESS` | `FAILED`).
- Keeps `VersionDetailPage` completely free of SSE socket plumbing.

### 4.2 `ExecutionCanvasNode.tsx`
Unifies `RunnerNodeComponent` (from `VersionDetailPage`) and `PreviewNodeComponent` (from `WorkflowCanvasPreview`):
- Accepts standardized `ExecutionNodeData` (label, category, iconType, detail, status: `idle` | `running` | `success` | `failed` | `skipped`, durationMs, outputSummary).
- Uses theme tokens (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`) instead of hardcoded hex or tailwind arbitrary classes.
- Accessible ARIA labels for node execution status.

### 4.3 `useDraftAutoSave.ts`
Extracted from `DesignerPage.tsx`:
- Takes `workflowId`, `nodes`, `edges`, and `saveIntervalMs` (default: `2000ms`).
- Handles debounce timeout management and cleanup on unmount.
- Exposes `isSaving`, `lastSavedAt`, and an immediate `forceSave()` promise used before publishing.

### 4.4 `WorkflowListPage.tsx` Dialog Decomposition
- Move `RenameWorkflowDialog` to a separate file with `isOpen`, `initialName`, `isLoading`, `onConfirm`, `onClose`.
- Move `DeleteWorkflowDialog` to a separate file with `isOpen`, `workflowName`, `isLoading`, `onConfirm`, `onClose`.
- Reduces `WorkflowListPage` state from 9 `useState` hooks to a clean state model or custom reducer.

---

## 5. Acceptance Criteria & Quality Checklist

- [ ] `VersionDetailPage.tsx` has fewer than 180 lines of code.
- [ ] `WorkflowListPage.tsx` has fewer than 180 lines of code.
- [ ] `WorkflowCanvasPreview.tsx` has fewer than 200 lines of code (simulation logic moved to helper/hook).
- [ ] No duplicated node rendering logic between `VersionDetailPage` and `WorkflowCanvasPreview`.
- [ ] All existing Vitest tests (`npm test` in `frontend/`) continue to pass without regression.
- [ ] TypeScript strict mode passes with 0 warnings or type errors.

