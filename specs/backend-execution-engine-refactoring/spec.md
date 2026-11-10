# Refactoring Specification: Decouple Workflow Execution Engine & Node Runner

> **Category:** Backend Architecture & Core Engine Maintainability  
> **Status:** Proposed  
> **Target Scope:** `monolith-backend/libs/execution/src/application/services/`

---

## 1. Problem Statement & Motivation

The workflow execution subsystem is the heart of FlowPilot, but its two central classes—`WorkflowEngine` (258 lines) and `NodeRunner` (326 lines)—are tightly coupled and suffer from severe **Single Responsibility Principle (SRP)** violations:

### 1.1 Direct Object Instantiation Bypassing NestJS Dependency Injection
In `WorkflowEngine.ts`:
```typescript
constructor(
  private readonly repository: ExecutionRepository,
  executors: INodeExecutor[],
  private readonly catalog: NodeCatalogPort,
  private readonly eventPublisher?: ExecutionEventPublisher,
) {
  this.runner = new NodeRunner(
    repository,
    new Map(executors.map((executor) => [executor.key, executor])),
    eventPublisher,
  );
}
```
`WorkflowEngine` creates `NodeRunner` with `new`, preventing `NodeRunner` from being mocked in isolation during unit tests, blocking separate middleware injection, and violating inversion of control.

### 1.2 `NodeRunner` Combines 6 Distinct Concerns
1. **Database Persistence:** Directly calls `repository.saveNodeLog` on start, success, and failure.
2. **Real-Time Event Publishing:** Calls `publishExecutionEventSafely(this.eventPublisher, ...)` with manual ISO string formatting.
3. **Credential Resolution:** Looks up OAuth/API credentials using `UUID_PATTERN` heuristics.
4. **Expression Resolution & Context Creation:** Assembles `createExpressionContext` and invokes `resolveConfig` for each run mode.
5. **Execution Strategy Dispatching:** Contains both single-item execution (`runOnce`) and array-based looping (`runPerItem`), with inline progress summaries (`ItemRunError`).
6. **Error Sanitization:** Contains regex-based password/token scrubbing.

### 1.3 `WorkflowEngine` Combines Graph Traversal with Operational State
`WorkflowEngine.runNodes` manages topological execution order, node activation checks, skip logging, offset calculations for routed items, and final status aggregation in one monolithic loop.

---

## 2. Goals & Non-Goals

### Goals
- **Decouple `NodeRunner` into cohesive collaborators**:
  - `NodeConfigResolver`: Resolves node credentials and evaluates config expressions.
  - `NodeExecutionObserver`: Encapsulates database audit logging and real-time SSE event publishing.
  - `OnceExecutionStrategy` and `PerItemExecutionStrategy`: Handles item iteration, progress tracking, and batch capping.
- **Enable full Dependency Injection**: Register `NodeRunner` and its strategies as NestJS providers so `WorkflowEngine` receives `NodeRunner` via constructor injection.
- **Maintain 100% backward compatibility** with existing node executors (`INodeExecutor`, `IOnceExecutor`, `IPerItemExecutor`) and execution event schemas.
- **Improve testability**: Unit tests can test graph traversal in `WorkflowEngine` with a mocked `NodeRunner`, and test expression resolution in `NodeConfigResolver` without mocking repositories or event publishers.

### Non-Goals
- Changing the execution state machine (`RUNNING`, `SUCCESS`, `FAILED`, `SKIPPED`).
- Altering BullMQ queue processing semantics or Prisma database schemas.

---

## 3. Architecture & Target Design

### 3.1 Collaboration Diagram

```
                 ┌──────────────────────────┐
                 │      WorkflowEngine      │
                 └─────────────┬────────────┘
                               │ delegates node execution
                               ▼
                 ┌──────────────────────────┐
                 │        NodeRunner        │
                 └──────┬─────────────┬─────┘
                        │             │
        ┌───────────────┘             └────────────────┐
        ▼                                              ▼
┌───────────────────────┐                    ┌─────────────────────────┐
│  NodeConfigResolver   │                    │  NodeExecutionObserver  │
│  - Resolve Credential │                    │  - saveNodeLog()        │
│  - resolveConfig()    │                    │  - publishEventSafely() │
│  - Expression Context │                    └─────────────────────────┘
└───────────────────────┘
        │
        ├─────────────────────────────┐
        ▼                             ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   OnceExecutionStrategy  │  │ PerItemExecutionStrategy │
│   - single batch execute │  │ - item loop & progress   │
└──────────────────────────┘  └──────────────────────────┘
```

### 3.2 Refactored Class Interfaces

#### `NodeConfigResolver`
```typescript
@Injectable()
export class NodeConfigResolver {
  constructor(private readonly repository: ExecutionRepository) {}

  async resolve(params: {
    executor: INodeExecutor;
    rawConfig: Record<string, unknown>;
    configSchema: unknown;
    ownerId: string;
    item: Item;
    index: number;
    runs: readonly NodeRun[];
    names: NodeNameIndex;
    sources?: readonly ItemSource[];
  }): Promise<{ config: unknown; credentialSecret?: unknown }> {
    // 1. Resolve credential if required
    // 2. Build expression context
    // 3. Interpolate expressions & parse schema defaults
  }
}
```

#### `NodeExecutionObserver`
```typescript
@Injectable()
export class NodeExecutionObserver {
  constructor(
    private readonly repository: ExecutionRepository,
    @Optional() private readonly eventPublisher?: ExecutionEventPublisher,
  ) {}

  async notifyStarted(context: NodeRunContext): Promise<void> { ... }
  async notifyCompleted(context: NodeRunContext, result: NodeRunResult): Promise<void> { ... }
  async notifyFailed(context: NodeRunContext, error: unknown): Promise<void> { ... }
  async notifySkipped(context: NodeRunContext): Promise<void> { ... }
}
```

#### `NodeRunner`
```typescript
@Injectable()
export class NodeRunner {
  constructor(
    private readonly configResolver: NodeConfigResolver,
    private readonly observer: NodeExecutionObserver,
    private readonly onceStrategy: OnceExecutionStrategy,
    private readonly perItemStrategy: PerItemExecutionStrategy,
    @Inject('NODE_EXECUTORS_MAP')
    private readonly executors: ReadonlyMap<string, INodeExecutor>,
  ) {}

  async run(params: NodeRunParams): Promise<NodeRunResult> {
    await this.observer.notifyStarted(params);
    try {
      const executor = this.getExecutor(params.node.data?.key);
      const result = executor.runMode === 'once'
        ? await this.onceStrategy.execute(executor, params)
        : await this.perItemStrategy.execute(executor, params);

      await this.observer.notifyCompleted(params, result);
      return result;
    } catch (error) {
      await this.observer.notifyFailed(params, error);
      throw error;
    }
  }
}
```

---

## 4. Benefits

1. **High Readability:** `WorkflowEngine` focuses purely on graph topology, dependency resolution, and workflow status. `NodeRunner` acts as a clean coordinator.
2. **Isolated Unit Testing:** Unit testing `WorkflowEngine` no longer requires in-memory database mocks for `NodeRunner` calls.
3. **Pluggable Execution Strategies:** New execution modes (e.g. streaming chunks, parallel item batching) can be added by implementing a new strategy without modifying `NodeRunner` or `WorkflowEngine`.

---

## 5. Acceptance Criteria & Quality Checklist

- [ ] `WorkflowEngine` receives `NodeRunner` via constructor dependency injection.
- [ ] Persistence (`saveNodeLog`) and SSE event publishing are extracted to `NodeExecutionObserver`.
- [ ] Credential and expression evaluation logic is extracted to `NodeConfigResolver`.
- [ ] All 50 existing backend tests (`npm test` in `monolith-backend/`) pass with zero regressions.
- [ ] New unit tests cover `NodeConfigResolver`, `NodeExecutionObserver`, and execution strategies individually with >90% code coverage.

