# Refactoring Specification: Frontend Data Layer Standardization & SSE Client Separation

> **Category:** Frontend Architecture & Data Layer  
> **Status:** Proposed  
> **Target Scope:** `frontend/src/features/workflow/services/`, `frontend/src/features/workflow/hooks/`, `frontend/src/features/workflow/pages/`

---

## 1. Problem Statement & Motivation

The frontend architecture currently suffers from two major data layer anti-patterns:

### 1.1 Components Directly Calling Raw Service APIs & Managing Server State Imperatively
The project coding standards state:
> *"Components DO NOT call APIs directly. Use React Query hooks which call a service layer."*  
> *"Server State: Use TanStack React Query (API data, caching, mutations)."*

In multiple components, this rule is violated:
- **`WorkflowListPage.tsx`**:
  - Directly imports `workflowService` and executes `workflowService.createWorkflow`, `workflowService.saveDraft`, `workflowService.renameWorkflow`, `workflowService.deleteWorkflow`.
  - Manages multiple manual `useState` boolean flags (`savingName`, `deleting`, `creating`, `creatingTemplate`, `actionError`) to track loading and error states.
  - Imperatively calls `await refetch()` after each operation, bypassing TanStack React Query's declarative cache invalidation and optimistic updates.
- **`DesignerPage.tsx`**:
  - Uses raw `useEffect` with manual promises (`Promise.all([workflowService.getDraft(workflowId), workflowService.getNodeTypes()])`) and a local `loading` state.
  - Saves drafts via raw `workflowService.saveDraft` inside `setTimeout` handlers.
  - Publishes workflows using raw `workflowService.publishWorkflow`.
  - Uses native browser `window.confirm` instead of shadcn/ui dialogs.

### 1.2 Monolithic `execution.service.ts` Overloaded with SSE Transport Logic
- `execution.service.ts` is 286 lines long.
- While lines 44–70 provide simple HTTP REST calls, lines 71–286 contain an entire custom Server-Sent Events (SSE) streaming transport client:
  - Custom line-splitting chunk buffer.
  - Manual exponential backoff retry loop.
  - Deduplication ring-buffer (`seenEventKeys`, `seenEventOrder`, `MAX_SEEN_EVENTS = 500`).
  - Terminal state event listeners and `AbortController` cancellation.
  - Direct dependency on `useAuthStore.getState().token`.
- Blending HTTP request dispatching with a stateful socket-like streaming engine complicates unit testing, increases coupling, and makes the service file hard to read and maintain.

---

## 2. Goals & Non-Goals

### Goals
- **Introduce standard React Query Mutation hooks** (`useWorkflowMutations`) for all write operations (`createWorkflow`, `renameWorkflow`, `deleteWorkflow`, `saveDraft`, `publishWorkflow`).
- **Remove all direct `workflowService.*` invocations from React components**, replacing them with typed mutation hooks that handle loading states, error toasts, and cache invalidation automatically.
- **Extract the SSE streaming engine** from `execution.service.ts` into a dedicated, testable transport module: `frontend/src/features/workflow/api/sse-client.ts` (`SseConnectionManager`).
- **Eliminate `window.confirm`** in `DesignerPage.tsx`, replacing it with a accessible shadcn/ui `AlertDialog`.
- **Introduce `useWorkflowDraft` query hook** in `DesignerPage.tsx` to handle draft loading with built-in caching, error boundaries, and suspense compatibility.

### Non-Goals
- Changing backend REST endpoints or SSE event schemas.
- Modifying authentication token refresh mechanics.

---

## 3. Architecture & Refactoring Design

### 3.1 React Query Hooks Layer

```
frontend/src/features/workflow/hooks/
├── useWorkflows.ts                  # Queries: useWorkflows (existing)
├── useWorkflowDraft.ts              # Query: useWorkflowDraft(workflowId) [NEW]
├── useWorkflowMutations.ts          # Mutations: create, rename, delete, save, publish [NEW]
└── useWorkflowVersions.ts           # Queries: useWorkflowVersions, useWorkflowVersion (existing)
```

#### Mutation Hook Interface (`useWorkflowMutations.ts`):
```typescript
export function useWorkflowMutations() {
  const queryClient = useQueryClient();

  const createWorkflowMutation = useMutation({
    mutationFn: (name: string) => workflowService.createWorkflow(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const renameWorkflowMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      workflowService.renameWorkflow(id, name),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflow', variables.id] });
    },
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: (id: string) => workflowService.deleteWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const publishWorkflowMutation = useMutation({
    mutationFn: (id: string) => workflowService.publishWorkflow(id),
    onSuccess: (_, workflowId) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
      queryClient.invalidateQueries({ queryKey: ['workflow-versions', workflowId] });
    },
  });

  return {
    createWorkflowMutation,
    renameWorkflowMutation,
    deleteWorkflowMutation,
    publishWorkflowMutation,
  };
}
```

### 3.2 SSE Client Modularization (`sse-client.ts`)

Extract the low-level streaming transport into a pure TypeScript class:

```
frontend/src/features/workflow/api/
├── execution.api.ts         # Axios REST calls
└── sse-client.ts            # SseConnectionManager (SSE chunk parsing, backoff, ring buffer)
```

#### `SseConnectionManager` Responsibilities:
- `connect(url: string, token?: string): () => void`
- Internal buffer decoding (`TextDecoder`), event frame parsing (`event: ...\ndata: ...\n\n`).
- Ring-buffer deduplication (`MAX_SEEN_EVENTS = 500`).
- Reconnection with jittered exponential backoff (up to `15_000ms`).
- `execution.service.ts` then becomes a clean, concise facade:
  ```typescript
  export const executionService = {
    startExecution: (input: StartExecutionInput) => executionApi.startExecution(input),
    getExecution: (executionId: string) => executionApi.getExecution(executionId),
    listExecutions: (req: ListExecutionsRequest) => executionApi.listExecutions(req),
    subscribeExecution: (executionId: string, onEvent, onConnectionChange) => {
      const url = executionApi.getEventStreamUrl(executionId);
      const token = useAuthStore.getState().token;
      return sseConnectionManager.subscribe(url, token, onEvent, onConnectionChange);
    },
  };
  ```

---

## 4. Impact on Components

### 4.1 `WorkflowListPage.tsx` Refactoring
- **Before:** 9 manual `useState` hooks, manual `try/catch` wrapping around each API call, manual `setSavingName(true/false)`, manual `await refetch()`.
- **After:**
  ```tsx
  const { renameWorkflowMutation, deleteWorkflowMutation, createWorkflowMutation } = useWorkflowMutations();
  
  // Clean declarative triggers:
  const handleRename = (id: string, name: string) => {
    renameWorkflowMutation.mutate({ id, name });
  };
  ```
  Loading states (`isPending`) and error states are derived directly from the mutations, cutting component code by ~50%.

### 4.2 `DesignerPage.tsx` Refactoring
- Replace `useEffect` draft loading with `useWorkflowDraft(workflowId)`.
- Replace `window.confirm` with a custom `PublishSuccessDialog` component built on shadcn/ui Dialog.

---

## 5. Acceptance Criteria & Quality Checklist

- [ ] Zero direct calls to `workflowService.*` in `WorkflowListPage.tsx` and `DesignerPage.tsx`.
- [ ] All asynchronous write operations in `WorkflowListPage` leverage TanStack React Query `useMutation`.
- [ ] `execution.service.ts` is under 80 lines of code; all SSE buffering and retry logic is housed in `sse-client.ts`.
- [ ] No native `window.confirm` or `alert` calls anywhere in `src/features/workflow/`.
- [ ] Unit tests for `SseConnectionManager` verify chunk assembly, reconnect backoff, and deduplication.
- [ ] All existing Vitest tests pass cleanly.

