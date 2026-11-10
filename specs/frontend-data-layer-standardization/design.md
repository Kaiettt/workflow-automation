# Design Document: Frontend Data Layer Standardization & SSE Client Separation

> **Specification:** `specs/frontend-data-layer-standardization/spec.md`  
> **Status:** Approved  
> **Date:** 2026-11-10  

---

## 1. Overview & Context

This design outlines the technical blueprint for standardizing the frontend data layer within `frontend/src/features/workflow/`. It addresses two primary architectural deficits:
1. Components (`WorkflowListPage.tsx`, `DesignerPage.tsx`) directly invoking `workflowService.*` imperative methods and managing transient server state (loading spinners, error alerts, cache refetches) through manual React `useState` and native browser dialogs (`window.confirm`, `window.alert`).
2. `execution.service.ts` acting as both an HTTP facade and a 200+ line stateful SSE streaming engine with chunk buffering, exponential backoff, and deduplication ring-buffers.

By moving server-state mutations to idiomatic TanStack React Query mutation hooks, isolating streaming transport into a pure TypeScript class `SseConnectionManager`, and converting browser dialogs to shadcn/ui components, we ensure strict alignment with FlowPilot Frontend Coding Standards (React 19, Feature-Based Architecture, TanStack Query, shadcn/ui).

---

## 2. Architecture & Design Decisions

### Decision 1: Dedicated `SseConnectionManager` Transport Module
- **Location:** `frontend/src/features/workflow/api/sse-client.ts`
- **Responsibility:**
  - Manages fetch-based SSE streaming over `ReadableStreamDefaultReader<Uint8Array>`.
  - Incremental chunk decoding via `TextDecoder` and frame splitting on `\n\n`.
  - SSE protocol event parsing (`event: <name>`, `data: <json>`).
  - Ring-buffer deduplication (`Set<string>` + index array capped at `MAX_SEEN_EVENTS = 500`).
  - Reconnection lifecycle with exponential backoff (`Math.min(500 * 2^attempt, 15_000ms)`).
  - Clean cancellation via `AbortController`.
  - Notification hooks: `onEvent`, `onConnectionChange`, and reconnect refresh callback `onReconnect`.

### Decision 2: Streamlined `execution.service.ts`
- **Location:** `frontend/src/features/workflow/services/execution.service.ts`
- **Responsibility:**
  - Acts as a thin facade over `executionApi` and `sseConnectionManager`.
  - Encapsulates execution REST actions: `startExecution`, `getExecution`, `listExecutions`.
  - Simplifies `subscribeExecution` into ~30 lines:
    1. Obtains event stream URL from `executionApi.getEventStreamUrl(executionId)`.
    2. Reads auth token from `useAuthStore.getState().token`.
    3. Passes event dispatcher and snapshot refresher (`executionService.getExecution`) to `sseConnectionManager.subscribe`.
  - File length drops from 286 lines to under 70 lines.

### Decision 3: Standard React Query Mutation Hooks (`useWorkflowMutations.ts`)
- **Location:** `frontend/src/features/workflow/hooks/useWorkflowMutations.ts`
- **Responsibility:**
  - `useCreateWorkflowMutation`: creates new blank workflow, invalidates `workflowKeys.all`.
  - `useCreateWorkflowFromTemplateMutation`: creates workflow and saves initial template graph draft, invalidates `workflowKeys.all`.
  - `useRenameWorkflowMutation`: renames workflow, invalidates `workflowKeys.all` and `['workflow-draft', id]`.
  - `useDeleteWorkflowMutation`: deletes workflow, invalidates `workflowKeys.all`.
  - `useSaveDraftMutation`: saves workflow draft graph, invalidates `['workflow-draft', id]` and `versionKeys.draftStatus(id)`.
  - `usePublishWorkflowMutation`: publishes current draft as a version, invalidates `workflowKeys.all`, `['workflow-draft', id]`, `versionKeys.all`, and trigger activations.
  - Export composite hook `useWorkflowMutations()` returning all mutation controllers.

### Decision 4: Query Hooks for Draft & Node Types (`useWorkflowDraft.ts`)
- **Location:** `frontend/src/features/workflow/hooks/useWorkflowDraft.ts`
- **Responsibility:**
  - `useWorkflowDraft(workflowId)`: executes `workflowService.getDraft(workflowId)` with query key `['workflow-draft', workflowId]`.
  - `useNodeTypes()`: executes `workflowService.getNodeTypes()` with query key `['node-types']` and 5-minute stale time.
  - Exposes standard TanStack Query return values (`data`, `isLoading`, `isError`, `error`).

### Decision 5: Accessible shadcn/ui Dialogs replacing `window.confirm` and `alert`
- **Locations:** `DesignerPage.tsx`, `WorkflowListPage.tsx`
- **Components:**
  - `PublishSuccessDialog`: Displays publish success info (version number, listening status/warning) and provides buttons for "Stay in Designer" and "View Version History".
  - `TemplateConfirmDialog`: Displays a confirmation prompt before overwriting a canvas with a template.
  - Error alert replaces browser `alert('Không thể tạo quy trình mới...')` in `WorkflowListPage.tsx`.

---

## 3. Class & Module Specifications

### 3.1 `SseConnectionManager` (`sse-client.ts`)

```typescript
export interface SseSubscribeOptions<TEvent> {
  url: string;
  token?: string | null;
  onEvent: (event: TEvent) => void;
  onConnectionChange?: (state: 'connected' | 'reconnecting' | 'disconnected') => void;
  onReconnect?: () => Promise<void>;
  isTerminal?: (event: TEvent) => boolean;
  maxSeenEvents?: number;
  maxReconnectDelayMs?: number;
}

export class SseConnectionManager {
  subscribe<TEvent extends { event: string; [key: string]: unknown }>(
    options: SseSubscribeOptions<TEvent>,
  ): () => void;
}
```

### 3.2 `useWorkflowMutations.ts`

```typescript
export function useWorkflowMutations() {
  const queryClient = useQueryClient();

  const createWorkflowMutation = useMutation({ ... });
  const createFromTemplateMutation = useMutation({ ... });
  const renameWorkflowMutation = useMutation({ ... });
  const deleteWorkflowMutation = useMutation({ ... });
  const saveDraftMutation = useMutation({ ... });
  const publishWorkflowMutation = useMutation({ ... });

  return {
    createWorkflowMutation,
    createFromTemplateMutation,
    renameWorkflowMutation,
    deleteWorkflowMutation,
    saveDraftMutation,
    publishWorkflowMutation,
  };
}
```

### 3.3 `useWorkflowDraft.ts`

```typescript
export const draftKeys = {
  all: ['workflow-draft'] as const,
  detail: (id: string) => [...draftKeys.all, id] as const,
  nodeTypes: ['node-types'] as const,
};

export function useWorkflowDraft(workflowId: string) {
  return useQuery({
    queryKey: draftKeys.detail(workflowId),
    queryFn: () => workflowService.getDraft(workflowId),
    enabled: Boolean(workflowId),
  });
}

export function useNodeTypes() {
  return useQuery({
    queryKey: draftKeys.nodeTypes,
    queryFn: () => workflowService.getNodeTypes(),
    staleTime: 5 * 60 * 1000,
  });
}
```

---

## 4. Migration Plan for Components

### 4.1 `WorkflowListPage.tsx`
- Remove: `import { workflowService } from '../services/workflow.service';`
- Remove: `savingName`, `deleting`, `creating`, `creatingTemplate` manual boolean states.
- Remove: imperative `await refetch()` after rename, delete, and create operations.
- Remove: `alert('Không thể tạo quy trình mới. Vui lòng thử lại!');` -> Set `actionError` state displayed in an accessible banner.
- Add: `const { createWorkflowMutation, createFromTemplateMutation, renameWorkflowMutation, deleteWorkflowMutation } = useWorkflowMutations();`
- Derive loading states: `createWorkflowMutation.isPending`, `renameWorkflowMutation.isPending`, `deleteWorkflowMutation.isPending`.

### 4.2 `DesignerPage.tsx`
- Remove: manual `useEffect` with `Promise.all([workflowService.getDraft, workflowService.getNodeTypes])`.
- Remove: manual `loading` state flag.
- Remove: direct `workflowService.saveDraft` and `workflowService.publishWorkflow`.
- Remove: `window.confirm` for publish follow-up and template overwrite.
- Add: `useWorkflowDraft(workflowId)` and `useNodeTypes()`.
- Add: `saveDraftMutation` and `publishWorkflowMutation`.
- Add: `PublishSuccessDialog` and `TemplateConfirmDialog` using shadcn/ui `Dialog`.

---

## 5. Verification & Testing

1. **Unit Testing `SseConnectionManager` (`sse-client.test.ts`):**
   - Framing and multi-line parsing of SSE chunks.
   - Ring buffer duplicate filtering.
   - Exponential reconnect backoff timing and termination on 401/403/404 HTTP statuses.
   - Terminal event abort and disconnect notification.
2. **Unit Testing Mutation & Draft Hooks (`useWorkflowMutations.test.tsx`, `useWorkflowDraft.test.tsx`):**
   - Query client invalidation verification on mutation success.
   - Draft and node-types fetching and caching behavior.
3. **Component & Integration Testing:**
   - Verify `execution.service.test.ts` passes without regressions.
   - Verify `DesignerPage.test.tsx` passes without regressions.
   - Run complete frontend Vitest test suite (`npm test --prefix frontend`).

