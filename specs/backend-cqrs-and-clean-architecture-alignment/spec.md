# Refactoring Specification: CQRS & Clean Architecture Alignment in Backend Presentation & Validation

> **Category:** Backend Clean Architecture & CQRS Standards  
> **Status:** Proposed  
> **Target Scope:** `monolith-backend/libs/designer/`, `monolith-backend/libs/execution/`

---

## 1. Problem Statement & Motivation

The backend guidelines established in `workflow-automation-backend-guidelines` dictate:
> - **Architecture**: Modular Monolith + Clean Architecture + CQRS.
> - **Layers**: `presentation -> application -> domain` and `infrastructure -> application, domain`. No inter-module domain imports.
> - **CQRS & Logic**: Handlers contain 1 orchestration flow. DO NOT return domain entities directly to `presentation/`, map to DTOs.
> - **Strict TypeScript**: NO `any`.

Currently, three prominent areas violate these core architectural rules:

### 1.1 Inconsistent CQRS in `WorkflowsController`
`monolith-backend/libs/designer/src/presentation/http/workflows.controller.ts`:
- **Direct Repository Injection in Controller:** Injects `WorkflowRepository` and `WorkflowVersionRepository` directly into `WorkflowsController`.
- **Bypassing CQRS Application Layer on Reads:** While commands (`CreateWorkflowCommand`, `RenameWorkflowCommand`, `DeleteWorkflowCommand`, `PublishWorkflowCommand`, `RestoreVersionCommand`) are dispatched through `CommandBus`, read endpoints (`getWorkflows`, `getVersions`, `getVersion`) bypass the `application` layer and query repositories directly.
- **Leaking Domain Entities to Presentation:** `getVersion()` directly returns the domain entity instance:
  ```typescript
  const version = await this.workflowVersionRepo.findById(versionId);
  return { success: true, data: version };
  ```
  This leaks internal database/domain structures to API consumers instead of mapping to a defined Response DTO.

### 1.2 Raw Express Response & Low-Level Streaming in `ExecutionController`
`monolith-backend/libs/execution/src/presentation/http/execution.controller.ts`:
- Uses `@Res() res: Response`, bypassing NestJS's execution context and response serialization pipeline.
- Implements low-level socket plumbing inside the controller action:
  - Manages raw response headers (`text/event-stream`, `no-transform`, `X-Accel-Buffering`).
  - Creates manual timer handles (`setInterval(..., 15000)`) for heartbeat pings.
  - Manages connection lifecycle state flags (`let closed = false`, `let unsubscribe = ...`, `res.on('close', ...)`).
- This violates single responsibility: the presentation controller is saddled with socket connection mechanics and transport lifecycle logic.

### 1.3 `workflow-validation.util.ts` Bypasses Type Safety
`monolith-backend/libs/designer/src/application/utils/workflow-validation.util.ts`:
- Opens with `/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */`.
- Uses `any` for virtually every parameter and variable (`nodes: any[]`, `node: any`, `node.data.key`, etc.).
- Bypasses TypeScript's static analysis, making graph reachability and config validation prone to runtime bugs when node structures evolve.

---

## 2. Goals & Non-Goals

### Goals
- **Enforce Strict CQRS in `WorkflowsController`**:
  - Remove direct repository injections (`WorkflowRepository`, `WorkflowVersionRepository`) from the controller.
  - Implement missing CQRS Queries: `GetWorkflowsQuery`, `GetWorkflowVersionsQuery`, and `GetWorkflowVersionQuery`.
  - Always map domain entities to presentation DTOs (`WorkflowSummaryDto`, `WorkflowVersionDto`).
- **Encapsulate SSE Streaming in `ExecutionController`**:
  - Replace raw `@Res() express.Response` manipulation with NestJS's idiomatic `@Sse()` annotation or an `ExecutionStreamService` returning an RxJS `Observable<MessageEvent>`.
  - Automatically manage heartbeat emissions and subscription disposal via RxJS operators (`interval`, `takeUntil`, `finalize`).
- **Eliminate `any` and ESLint suppressions in `workflow-validation.util.ts`**:
  - Introduce strongly typed interfaces for `WorkflowValidationNode`, `WorkflowValidationEdge`, and `CatalogTypeDefinition`.
  - Re-enable all ESLint safety rules without warnings or errors.

### Non-Goals
- Changing database schemas or Prisma models.
- Altering HTTP status codes or API response envelopes (`{ success: true, data: ... }`).

---

## 3. Architecture & Refactoring Design

### 3.1 Strict CQRS Query Flow for Workflows

```
Presentation: WorkflowsController
       │
       │ dispatches GetWorkflowVersionQuery
       ▼
Application: GetWorkflowVersionHandler
       │
       │ calls WorkflowVersionRepository
       ▼
Domain / Infrastructure: WorkflowVersionRepository (Prisma)
       │
       │ returns WorkflowVersion entity
       ▼
Application: Maps WorkflowVersion -> WorkflowVersionResponseDto
       │
       ▼
Presentation: returns { success: true, data: WorkflowVersionResponseDto }
```

#### New Queries to Add:
1. `libs/designer/src/application/queries/get-workflows/`
   - `get-workflows.query.ts`
   - `get-workflows.handler.ts`
2. `libs/designer/src/application/queries/get-workflow-versions/`
   - `get-workflow-versions.query.ts`
   - `get-workflow-versions.handler.ts`
3. `libs/designer/src/application/queries/get-workflow-version/`
   - `get-workflow-version.query.ts`
   - `get-workflow-version.handler.ts`

### 3.2 Idiomatic NestJS SSE with RxJS in `ExecutionController`

Replace lines 59–130 of `ExecutionController` with NestJS `@Sse()`:

```typescript
@Sse(':executionId/events')
@ApiOperation({ summary: 'Subscribe to execution lifecycle events via SSE' })
streamEvents(
  @Param('executionId') executionId: string,
  @CurrentUser() user: AuthenticatedUser,
): Observable<MessageEvent> {
  // 1. Verify access via query handler
  // 2. Delegate to ExecutionStreamService which produces an RxJS Observable
  return this.streamService.createStream(executionId, user.id);
}
```

#### `ExecutionStreamService`:
- Uses RxJS `Observable` with `merge(eventStream$, heartbeat$)`.
- Automatically tears down the listener and cancels timers upon client disconnect (`finalize()`).
- Completely cleans up `ExecutionController`.

### 3.3 Strict Typing for `workflow-validation.util.ts`

Define explicit types:
```typescript
export interface ValidationWorkflowNode {
  id: string;
  type?: string;
  data?: {
    key?: string;
    name?: string;
    config?: Record<string, unknown>;
  };
}

export interface ValidationWorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}
```
Remove `eslint-disable` and enforce type narrowing.

---

## 4. Acceptance Criteria & Quality Checklist

- [ ] `WorkflowsController` has zero direct repository dependencies; all operations go through `CommandBus` or `QueryBus`.
- [ ] No domain entities are returned directly in HTTP controller responses; all are mapped to typed DTOs.
- [ ] `ExecutionController` no longer relies on `@Res() res: Response` or manual `setInterval` heartbeats.
- [ ] `workflow-validation.util.ts` has 0 instances of `any` and 0 disabled ESLint rules.
- [ ] All unit and integration tests (`npm test`) pass without regression.

