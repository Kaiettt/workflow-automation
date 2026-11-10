# Task List: Frontend Data Layer Standardization & SSE Client Separation

- [x] **Phase 1: SSE Streaming Client Extraction**
  - [x] 1.1 Create `frontend/src/features/workflow/api/sse-client.ts` with `SseConnectionManager`.
  - [x] 1.2 Update `frontend/src/features/workflow/api/execution.api.ts` to export `getEventStreamUrl(executionId)`.
  - [x] 1.3 Refactor `frontend/src/features/workflow/services/execution.service.ts` to delegate SSE mechanics to `sseConnectionManager`.
  - [x] 1.4 Write unit tests in `frontend/src/features/workflow/api/sse-client.test.ts`.
  - [x] 1.5 Verify `execution.service.test.ts` and `sse-client.test.ts` pass cleanly.

- [x] **Phase 2: React Query Hooks (Mutations & Draft Query)**
  - [x] 2.1 Create `frontend/src/features/workflow/hooks/useWorkflowMutations.ts` with all mutation hooks and query invalidations.
  - [x] 2.2 Create `frontend/src/features/workflow/hooks/useWorkflowDraft.ts` with `useWorkflowDraft` and `useNodeTypes`.
  - [x] 2.3 Create unit tests in `frontend/src/features/workflow/hooks/useWorkflowMutations.test.tsx`.
  - [x] 2.4 Create unit tests in `frontend/src/features/workflow/hooks/useWorkflowDraft.test.tsx`.
  - [x] 2.5 Verify hooks tests pass cleanly.

- [x] **Phase 3: Component Migration & Dialog Standardization**
  - [x] 3.1 Refactor `frontend/src/features/workflow/pages/WorkflowListPage.tsx`:
    - Remove direct `workflowService` calls and replace with `useWorkflowMutations`.
    - Derive loading states from mutations and eliminate manual boolean flags (`savingName`, `deleting`, `creating`).
    - Remove native `alert()` and replace with UI error state.
  - [x] 3.2 Refactor `frontend/src/features/workflow/pages/DesignerPage.tsx`:
    - Replace manual `useEffect` fetching with `useWorkflowDraft` and `useNodeTypes`.
    - Replace direct `workflowService.saveDraft` and `workflowService.publishWorkflow` with mutations from `useWorkflowMutations`.
    - Create accessible `PublishSuccessDialog` component (or inline Dialog) replacing `window.confirm` for publish follow-up.
    - Create template overwrite confirmation dialog replacing `window.confirm` for template selection.
  - [x] 3.3 Verify `DesignerPage.test.tsx` and all affected tests pass cleanly.

- [x] **Phase 4: Full Verification & Compact Summary**
  - [x] 4.1 Run full frontend test suite: `npm test --prefix frontend`.
  - [x] 4.2 Run frontend linter: `npm run lint --prefix frontend`.
  - [x] 4.3 Create compact summary `specs/frontend-data-layer-standardization/compact.md`.
  - [x] 4.4 Prompt user to run `/compact`.
