# Implementation Plan: Frontend Data Layer Standardization & SSE Client Separation

## Overview
Migrate imperative data fetching and direct API invocations to idiomatic TanStack React Query hooks, and isolate the SSE streaming client from `execution.service.ts`.

---

## Phase 1: Extract SSE Streaming Client (`sse-client.ts`)

### Tasks
1. Create `frontend/src/features/workflow/api/sse-client.ts`:
   - Implement `SseConnectionManager` class.
   - Move chunk buffering, line splitting, reconnect backoff, and event deduplication ring-buffer into this class.
2. Refactor `frontend/src/features/workflow/services/execution.service.ts`:
   - Delegate `subscribeExecution` to `sseConnectionManager`.
   - Remove internal private classes (`ExecutionStreamHttpError`), buffer constants, and state tracking.
3. Create unit tests in `frontend/src/features/workflow/api/sse-client.test.ts` to test event parsing, abnormal connection terminations, and backoff limits.

---

## Phase 2: Create React Query Mutation & Draft Query Hooks

### Tasks
1. Create `frontend/src/features/workflow/hooks/useWorkflowMutations.ts`:
   - Implement `useCreateWorkflowMutation`, `useRenameWorkflowMutation`, `useDeleteWorkflowMutation`, `usePublishWorkflowMutation`.
   - Configure cache invalidation (`queryClient.invalidateQueries`) for affected keys (`['workflows']`, `['workflow', id]`, `['workflow-versions', id]`).
2. Create `frontend/src/features/workflow/hooks/useWorkflowDraft.ts`:
   - Query draft definition and validation errors using `useQuery({ queryKey: ['workflow-draft', workflowId], queryFn: ... })`.
3. Add unit tests for both hooks using `@testing-library/react` and `QueryClientProvider` wrappers.

---

## Phase 3: Migrate Pages & Remove Native Alerts

### Tasks
1. Refactor `WorkflowListPage.tsx`:
   - Replace manual `useState` booleans (`savingName`, `deleting`, `creating`) with mutation states (`isPending`).
   - Remove direct `workflowService` imports and manual `refetch()` invocations.
2. Refactor `DesignerPage.tsx`:
   - Replace `useEffect` with `useWorkflowDraft`.
   - Replace `window.confirm` with a shadcn/ui `PublishSuccessDialog` modal.
3. Run `npm test` inside `frontend/` to ensure all tests pass.

