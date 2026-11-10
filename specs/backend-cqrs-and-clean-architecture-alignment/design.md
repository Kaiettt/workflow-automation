# Technical Design: CQRS & Clean Architecture Alignment in Backend Presentation & Validation

> **Feature / Scope:** Backend Clean Architecture & CQRS Standards  
> **Status:** Draft -> Approved  
> **Target Scope:** `monolith-backend/libs/designer/`, `monolith-backend/libs/execution/`  
> **Spec Reference:** [spec.md](file:///c:/project/tlcn/workflow-automation/specs/backend-cqrs-and-clean-architecture-alignment/spec.md)

---

## 1. Context & Architectural Overview

The backend guidelines established in `workflow-automation-backend-guidelines` enforce:
- **Clean Architecture & CQRS**: Controllers (`presentation/`) orchestrate via `CommandBus` and `QueryBus`.
- **Decoupling Layers**: Controllers must never inject domain repositories directly or leak domain entities to API consumers.
- **Idiomatic NestJS Streaming**: Controllers delegate transport streaming to NestJS `@Sse()` and dedicated domain/application streaming services rather than managing low-level Express `@Res()` sockets, manual headers, and interval timers.
- **Strict TypeScript**: Zero `any` types and zero ESLint rule suppressions.

This design covers 3 interconnected refactoring tracks:
1. **CQRS Queries in Designer**: Encapsulating workflow reads into dedicated query handlers (`GetWorkflowsQuery`, `GetWorkflowVersionsQuery`, `GetWorkflowVersionQuery`) and returning response DTOs.
2. **NestJS `@Sse` in Execution**: Replacing Express `@Res()` socket management in `ExecutionController` with an RxJS-based `ExecutionStreamService` powering `@Sse(':executionId/events')`.
3. **Type Safety in Workflow Validation**: Replacing all `any` types and removing ESLint disable comments in `workflow-validation.util.ts`.

---

## 2. Detailed Component Design

### 2.1 Designer Module: Strict CQRS Reads

#### 2.1.1 Query Handlers & DTOs
Location: `monolith-backend/libs/designer/src/application/queries/`

1. **`GetWorkflowsQuery` & Handler (`get-workflows.query.ts`)**
   - Query: `GetWorkflowsQuery(public readonly ownerId: string)`
   - Handler: `GetWorkflowsHandler`
   - Injects: `WorkflowRepository`
   - Returns: `WorkflowSummaryDto[]`
   ```typescript
   export interface WorkflowSummaryDto {
     id: string;
     name: string;
     status: string;
     active: boolean;
     createdAt: Date;
     updatedAt: Date;
   }
   ```

2. **`GetWorkflowVersionsQuery` & Handler (`get-workflow-versions.query.ts`)**
   - Query: `GetWorkflowVersionsQuery(public readonly workflowId: string)`
   - Handler: `GetWorkflowVersionsHandler`
   - Injects: `WorkflowRepository`, `WorkflowVersionRepository`
   - Logic:
     - Checks if workflow exists; if not, throws `NotFoundException`.
     - Fetches versions via `workflowVersionRepo.findByWorkflowId(workflowId)`.
     - Maps to `WorkflowVersionSummaryDto[]`:
     ```typescript
     export interface WorkflowVersionSummaryDto {
       id: string;
       workflowId: string;
       versionNumber: number;
       publishedAt: Date;
       publishedById: string;
     }
     ```

3. **`GetWorkflowVersionQuery` & Handler (`get-workflow-version.query.ts`)**
   - Query: `GetWorkflowVersionQuery(public readonly workflowId: string, public readonly versionId: string)`
   - Handler: `GetWorkflowVersionHandler`
   - Injects: `WorkflowRepository`, `WorkflowVersionRepository`
   - Logic:
     - Checks if workflow exists; if not, throws `NotFoundException`.
     - Fetches version via `workflowVersionRepo.findById(versionId)`.
     - If not found or `version.workflowId !== workflowId`, throws `NotFoundException`.
     - Maps to `WorkflowVersionDetailDto`.

#### 2.1.2 Controller Refactoring
`monolith-backend/libs/designer/src/presentation/http/workflows.controller.ts`:
- Remove `WorkflowRepository` and `WorkflowVersionRepository` dependencies.
- Constructor only requires: `CommandBus`, `QueryBus`.
- Endpoints `getWorkflows`, `getVersions`, `getVersion` delegate directly to `QueryBus.execute()`.
- Return format remains standard: `{ success: true, data: result }`.

---

### 2.2 Execution Module: Idiomatic SSE with RxJS

#### 2.2.1 `ExecutionStreamService`
Location: `monolith-backend/libs/execution/src/application/services/execution-stream.service.ts`

- Injects:
  - `QueryBus` (for access control and fetching initial snapshot via `GetExecutionQuery`)
  - `ExecutionEventPublisher` (for subscribing to lifecycle events)
- Public API:
  ```typescript
  createStream(executionId: string, userId: string): Observable<MessageEvent>
  ```
- Workflow inside `createStream`:
  1. Asynchronously queries `GetExecutionQuery(executionId, userId)` to verify access and obtain the initial snapshot. If unauthorized or not found, an error is propagated.
  2. Creates an RxJS `Observable<MessageEvent>`:
     - Emits `execution.snapshot` event with the current execution payload.
     - If snapshot indicates a terminal status (`SUCCESS`, `FAILED`, `CANCELLED`), emits snapshot and completes.
     - Otherwise, registers subscriber via `this.eventPublisher.subscribe(executionId, listener)`.
     - On incoming event from publisher, emits `{ type: event.event, data: event }`.
     - If incoming event is terminal (`isTerminalExecutionState(event.event, event.status)`), completes.
     - Runs a heartbeat interval (every 15s) emitting `{ type: 'heartbeat', data: { ts: new Date().toISOString() } }`.
     - Teardown: In the Observable cleanup callback (on unsubscribe/disconnect), unregisters publisher listener and clears heartbeat timer.

#### 2.2.2 `ExecutionController` SSE Endpoint
Location: `monolith-backend/libs/execution/src/presentation/http/execution.controller.ts`

- Replace raw Express `@Res() res: Response` handler with NestJS `@Sse()`:
  ```typescript
  @Sse(':executionId/events')
  @ApiOperation({ summary: 'Subscribe to execution lifecycle events via SSE' })
  streamEvents(
    @Param('executionId') executionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Observable<MessageEvent> {
    return this.streamService.createStream(executionId, user.id);
  }
  ```

---

### 2.3 Strict Typing for `workflow-validation.util.ts`

Location: `monolith-backend/libs/designer/src/application/utils/workflow-validation.util.ts`

#### 2.3.1 Interface Definitions
```typescript
export interface ValidationWorkflowNodeData {
  key?: string;
  name?: string;
  config?: Record<string, unknown>;
}

export interface ValidationWorkflowNode {
  id: string;
  type?: string;
  data?: ValidationWorkflowNodeData;
}

export interface ValidationWorkflowEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface NodeCatalogTypeMetadata {
  category?: string;
  configSchema?: unknown;
}
```

#### 2.3.2 Removing ESLint Suppressions
- Remove line 1 (`/* eslint-disable ... */`).
- Replace all parameter and variable `any` references with `ValidationWorkflowNode`, `ValidationWorkflowEdge`, and `NodeCatalogTypeMetadata`.
- Add proper type guards and narrowing for config schema verification.

---

## 3. Verification & Testing Strategy

1. **Designer CQRS Unit Tests**:
   - Verify `GetWorkflowsHandler`, `GetWorkflowVersionsHandler`, and `GetWorkflowVersionHandler` properly query repos and throw `NotFoundException` when appropriate.
   - Run existing `publish-workflow.handler.spec.ts`.
2. **Execution SSE Unit Tests**:
   - Update `execution.controller.spec.ts` to test `ExecutionStreamService` and the `@Sse()` controller method using RxJS subscriptions.
   - Test initial snapshot emission, stream open during `RUNNING`, stream termination on terminal states (`SUCCESS`, `FAILED`, `CANCELLED`), and access rejection.
3. **Validation Utility Unit Tests**:
   - Run `workflow-validation.util.spec.ts` to confirm 100% test pass with zero regressions.
4. **Lint & Static Analysis**:
   - Run `npm run lint` in `monolith-backend` to ensure 0 lint errors or warnings.

