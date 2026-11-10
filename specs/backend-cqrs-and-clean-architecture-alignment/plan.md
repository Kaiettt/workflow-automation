# Implementation Plan: CQRS & Clean Architecture Alignment in Backend

## Overview
Implement missing CQRS queries in `designer`, replace raw Express SSE streaming with NestJS `@Sse()` in `execution`, and introduce strict typing to `workflow-validation.util.ts`.

---

## Phase 1: Implement Missing CQRS Queries in `libs/designer`

### Tasks
1. Implement `GetWorkflowsQuery`:
   - Query definition, handler, and response DTO (`WorkflowSummaryDto`).
   - Unit tests in `test/unit/designer/queries/get-workflows.handler.spec.ts`.
2. Implement `GetWorkflowVersionsQuery` & `GetWorkflowVersionQuery`:
   - Query definitions, handlers, and response DTOs (`WorkflowVersionDto`).
   - Unit tests in `test/unit/designer/queries/get-workflow-versions.handler.spec.ts`.
3. Refactor `WorkflowsController`:
   - Remove `WorkflowRepository` and `WorkflowVersionRepository` from constructor.
   - Replace direct repository calls with `this.queryBus.execute(...)`.
   - Update `designer.module.ts` provider list.

---

## Phase 2: Refactor `ExecutionController` SSE Streaming with RxJS

### Tasks
1. Create `monolith-backend/libs/execution/src/infrastructure/adapters/execution-stream.service.ts`:
   - Encapsulate event subscription and heartbeat intervals as an RxJS `Observable<MessageEvent>`.
   - Handle teardown on observer unsubscribe (`finalize`).
2. Refactor `ExecutionController`:
   - Replace `@Res()` endpoint with `@Sse(':executionId/events')`.
   - Delegate stream creation to `ExecutionStreamService`.
3. Add unit tests for `ExecutionStreamService` verifying event emission, heartbeat intervals, and subscription cleanup.

---

## Phase 3: Type Safety & ESLint Alignment in `workflow-validation.util.ts`

### Tasks
1. Define strict domain types (`ValidationWorkflowNode`, `ValidationWorkflowEdge`, `CatalogTypeDefinition`).
2. Remove top-level `/* eslint-disable ... */` comments.
3. Replace all `any` usages with type narrowing and defensive validation.
4. Run ESLint (`npm run lint` in `monolith-backend/`) and unit tests.

