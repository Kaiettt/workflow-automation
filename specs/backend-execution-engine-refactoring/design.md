# Technical Design: Decouple Workflow Execution Engine & Node Runner

> **Phase:** 3  
> **Status:** Approved  
> **Related Spec:** [spec.md](file:///c:/project/tlcn/workflow-automation/specs/backend-execution-engine-refactoring/spec.md)  
> **Target Scope:** `monolith-backend/libs/execution/src/application/services/`

---

## 1. Overview & Architectural Goals

The current workflow execution engine in `monolith-backend/libs/execution` couples graph traversal, node lifecycle events, database auditing, credential resolution, expression interpolation, and execution strategies into two large classes:
- `WorkflowEngine` (258 lines)
- `NodeRunner` (326 lines)

`WorkflowEngine` directly instantiates `NodeRunner` via `new NodeRunner(...)`, which bypasses NestJS dependency injection and prevents isolated unit testing of graph scheduling logic. Furthermore, both classes redundantly interact with `ExecutionRepository.saveNodeLog` and `ExecutionEventPublisher`.

### Architectural Objectives:
1. **Single Responsibility Principle (SRP):** Split execution concerns into cohesive, dedicated collaborators:
   - `NodeExecutionObserver`: Persistence (`saveNodeLog`) and real-time SSE event publishing.
   - `NodeConfigResolver`: Credential retrieval and expression interpolation.
   - `OnceExecutionStrategy`: Single batch node execution (`IOnceExecutor`).
   - `PerItemExecutionStrategy`: Array iteration, item limits, and multi-output routing (`IPerItemExecutor`).
   - `NodeRunner`: Coordination between config resolution, strategy execution, and observer notifications.
2. **NestJS Dependency Injection:** Register all extracted collaborators and `NodeRunner` as first-class providers in `ExecutionModule`.
3. **100% Backward Compatibility:** Maintain a dual-mode constructor in `WorkflowEngine` and a factory method in `NodeRunner` so existing unit tests that instantiate `new WorkflowEngine(repository, executors, catalog)` continue to pass without modification.
4. **Isolated Testability:** Enable independent unit testing for credential resolution, event observation, execution strategies, and graph orchestration.

---

## 2. Component Design & Interfaces

```
                           ┌──────────────────────────┐
                           │      WorkflowEngine      │
                           └─────────────┬────────────┘
                                         │
                 ┌───────────────────────┴──────────────────────┐
                 ▼                                              ▼
   ┌───────────────────────────┐                  ┌───────────────────────────┐
   │        NodeRunner         │                  │   NodeExecutionObserver   │
   └─────────────┬─────────────┘                  │   - notifyStarted()       │
                 │                                │   - notifyCompleted()     │
         ┌───────┴───────┐                        │   - notifyFailed()        │
         ▼               ▼                        │   - notifySkipped()       │
┌─────────────────┐ ┌───────────────────────────┐ └───────────────────────────┘
│NodeConfigResolver OnceExecutionStrategy       │
│- resolveCreds() │ │ PerItemExecutionStrategy  │
│- resolveConfig()│ └───────────────────────────┘
└─────────────────┘
```

### 2.1 `NodeExecutionObserver`
**File:** `monolith-backend/libs/execution/src/application/services/node-execution-observer.ts`

Encapsulates audit logging and event publishing for node execution lifecycle events.
```typescript
@Injectable()
export class NodeExecutionObserver {
  constructor(
    private readonly repository: ExecutionRepository,
    @Optional() private readonly eventPublisher?: ExecutionEventPublisher,
  ) {}

  async notifyStarted(params: NodeRunParams, startedAt: Date): Promise<void>;
  async notifyCompleted(
    params: NodeRunParams,
    result: { output: Item[]; log?: Partial<NodeLogRecord> },
    startedAt: Date,
    finishedAt: Date,
  ): Promise<NodeRunResult>;
  async notifyFailed(
    params: NodeRunParams,
    error: unknown,
    startedAt: Date,
    finishedAt: Date,
  ): Promise<NodeRunResult>;
  async notifySkipped(params: {
    executionId: string;
    workflowId: string;
    workflowVersionId: string;
    node: WorkflowNode;
    timestamp: Date;
  }): Promise<void>;
}
```

### 2.2 `NodeConfigResolver`
**File:** `monolith-backend/libs/execution/src/application/services/node-config-resolver.ts`

Encapsulates credential lookup, UUID validation, expression context construction, and schema default interpolation.
```typescript
@Injectable()
export class NodeConfigResolver {
  constructor(private readonly repository: ExecutionRepository) {}

  async resolveCredential(
    executor: INodeExecutor,
    rawConfig: Record<string, unknown>,
    ownerId: string,
  ): Promise<unknown>;

  resolveRunConfig(
    executor: INodeExecutor,
    rawConfig: Record<string, unknown>,
    configSchema: unknown,
    contextParams: {
      runs: readonly NodeRun[];
      names: NodeNameIndex;
      currentItem: Item;
      currentIndex: number;
      currentSources?: readonly ItemSource[];
    },
  ): unknown;
}
```

### 2.3 Execution Strategies
**Directory:** `monolith-backend/libs/execution/src/application/services/strategies/`

#### `OnceExecutionStrategy` (`once-execution.strategy.ts`):
```typescript
@Injectable()
export class OnceExecutionStrategy {
  constructor(private readonly configResolver: NodeConfigResolver) {}

  async execute(
    executor: IOnceExecutor,
    rawConfig: Record<string, unknown>,
    params: NodeRunParams,
  ): Promise<Map<string, Item[]>>;
}
```

#### `PerItemExecutionStrategy` (`per-item-execution.strategy.ts`):
```typescript
@Injectable()
export class PerItemExecutionStrategy {
  constructor(private readonly configResolver: NodeConfigResolver) {}

  async execute(
    executor: IPerItemExecutor,
    rawConfig: Record<string, unknown>,
    params: NodeRunParams,
  ): Promise<Map<string, Item[]>>;
}
```

### 2.4 Refactored `NodeRunner`
**File:** `monolith-backend/libs/execution/src/application/services/node-runner.ts`

- Injected with:
  - `NodeConfigResolver`
  - `NodeExecutionObserver`
  - `OnceExecutionStrategy`
  - `PerItemExecutionStrategy`
  - `ReadonlyMap<string, INodeExecutor>` (via `'NODE_EXECUTORS_MAP'`)
- Provides `static create(repository, executorsMap, publisher)` helper for backward compatibility in non-DI environments.
- Shrinks from 326 lines to ~80 lines.

### 2.5 Refactored `WorkflowEngine`
**File:** `monolith-backend/libs/execution/src/application/services/workflow-engine.ts`

- Injected with:
  - `ExecutionRepository`
  - `NodeCatalogPort`
  - `NodeRunner`
  - `NodeExecutionObserver`
  - `@Optional() ExecutionEventPublisher`
- Overloaded constructor supporting legacy signature `(repository, executors, catalog, publisher)` for existing tests.
- Replaces inline skipped node logging and SSE publishing with `this.observer.notifySkipped(...)`.

---

## 3. NestJS Module Wiring (`ExecutionModule`)

Register new providers in `monolith-backend/libs/execution/src/execution.module.ts`:
```typescript
providers: [
  // ... existing executors
  {
    provide: 'NODE_EXECUTORS_MAP',
    useFactory: (executors: INodeExecutor[]) =>
      new Map(executors.map((e) => [e.key, e])),
    inject: ['NODE_EXECUTORS'],
  },
  NodeConfigResolver,
  NodeExecutionObserver,
  OnceExecutionStrategy,
  PerItemExecutionStrategy,
  {
    provide: NodeRunner,
    useFactory: (
      configResolver: NodeConfigResolver,
      observer: NodeExecutionObserver,
      onceStrategy: OnceExecutionStrategy,
      perItemStrategy: PerItemExecutionStrategy,
      executors: ReadonlyMap<string, INodeExecutor>,
    ) => new NodeRunner(configResolver, observer, onceStrategy, perItemStrategy, executors),
    inject: [
      NodeConfigResolver,
      NodeExecutionObserver,
      OnceExecutionStrategy,
      PerItemExecutionStrategy,
      'NODE_EXECUTORS_MAP',
    ],
  },
  {
    provide: WorkflowEngine,
    useFactory: (
      repository: ExecutionRepository,
      catalog: NodeCatalogPort,
      runner: NodeRunner,
      observer: NodeExecutionObserver,
      publisher: ExecutionEventPublisher,
    ) => new WorkflowEngine(repository, catalog, runner, observer, publisher),
    inject: [
      ExecutionRepository,
      NodeCatalogPort,
      NodeRunner,
      NodeExecutionObserver,
      ExecutionEventPublisher,
    ],
  },
  // ... rest of providers
]
```

---

## 4. Verification Plan

1. **Unit Tests:**
   - `test/unit/execution/application/node-execution-observer.spec.ts` (test started, completed, failed, skipped events & logs)
   - `test/unit/execution/application/node-config-resolver.spec.ts` (test credential resolution, validation, expression resolution)
   - `test/unit/execution/application/strategies/execution-strategies.spec.ts` (test once & per-item strategy logic, cap checks, routing)
   - `test/unit/execution/application/node-runner.spec.ts` (test node runner execution lifecycle & error handling)
2. **Regression Testing:**
   - Run all existing 23 unit test suites in `monolith-backend/test/unit/execution/`.
   - Ensure all 318+ tests pass with 0 regressions.
3. **Linting:**
   - Run `npx eslint libs/execution/ test/unit/execution/` with 0 warnings or errors.

