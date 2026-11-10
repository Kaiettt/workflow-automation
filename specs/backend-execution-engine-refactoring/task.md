# Task Checklist: Decouple Workflow Execution Engine & Node Runner

> **Phase:** 3  
> **Status:** Completed  
> **Related Design:** [design.md](file:///c:/project/tlcn/workflow-automation/specs/backend-execution-engine-refactoring/design.md)

---

## Phase 3 Implementation Tasks

### 1. Extract Collaborator Services
- [x] Create `monolith-backend/libs/execution/src/application/services/node-execution-observer.ts`
  - Implement `notifyStarted(params, startedAt)`: persists RUNNING log, publishes `node.started`.
  - Implement `notifyCompleted(params, result, startedAt, finishedAt)`: persists completed log, publishes `node.completed`.
  - Implement `notifyFailed(params, error, startedAt, finishedAt)`: sanitizes error message, persists FAILED log, publishes `node.failed`.
  - Implement `notifySkipped(params)`: persists SKIPPED log, publishes `node.skipped`.
- [x] Create `monolith-backend/libs/execution/src/application/services/node-config-resolver.ts`
  - Move `resolveCredential` (UUID validation, repository lookup, connectorKey check).
  - Move `applySchemaDefaults` and `resolveRunConfig` (expression context binding, `resolveConfig`).
- [x] Create unit tests for collaborator services:
  - `monolith-backend/test/unit/execution/application/node-execution-observer.spec.ts`
  - `monolith-backend/test/unit/execution/application/node-config-resolver.spec.ts`

### 2. Extract Execution Strategies
- [x] Create `monolith-backend/libs/execution/src/application/services/strategies/once-execution.strategy.ts`
  - Implement `execute(executor, rawConfig, params)`: resolve credential & config, invoke `executor.execute()`, validate item array output structure.
- [x] Create `monolith-backend/libs/execution/src/application/services/strategies/per-item-execution.strategy.ts`
  - Implement `execute(executor, rawConfig, params)`: evaluate item cap limit (`executor.maxItems`), loop through items, evaluate per-item expressions, handle `RoutedItem` output keys, wrap partial failure in `ItemRunError`.
- [x] Create unit tests for execution strategies:
  - `monolith-backend/test/unit/execution/application/execution-strategies.spec.ts`

### 3. Refactor `NodeRunner`
- [x] Update `monolith-backend/libs/execution/src/application/services/node-runner.ts`
  - Inject `NodeConfigResolver`, `NodeExecutionObserver`, `OnceExecutionStrategy`, `PerItemExecutionStrategy`, and executors map.
  - Simplify `run()` method to delegate to strategies and observer.
  - Provide `NodeRunner.create()` factory for testing / non-DI instantiation.
- [x] Create unit test for `NodeRunner`:
  - `monolith-backend/test/unit/execution/application/node-runner.spec.ts`

### 4. Refactor `WorkflowEngine`
- [x] Update `monolith-backend/libs/execution/src/application/services/workflow-engine.ts`
  - Support constructor injection of `runner` and `observer`.
  - Retain dual-mode constructor for existing test suites passing `(repository, executors, catalog, publisher)`.
  - Replace inline skipped log & event emission with `this.observer.notifySkipped(...)`.

### 5. Wire NestJS Dependency Injection
- [x] Update `monolith-backend/libs/execution/src/execution.module.ts`
  - Register `'NODE_EXECUTORS_MAP'`, `NodeConfigResolver`, `NodeExecutionObserver`, `OnceExecutionStrategy`, `PerItemExecutionStrategy`, `NodeRunner`, and updated `WorkflowEngine` factory.

### 6. Verification & Completion
- [x] Run complete execution unit test suite: `cd monolith-backend && npx jest test/unit/execution`
- [x] Run full backend test suite: `cd monolith-backend && npx jest test/unit/designer test/unit/execution --maxWorkers=2` (27/27 suites, 342/342 tests passed)
- [x] Run linter: `cd monolith-backend && npx eslint ...` (0 errors, 0 warnings)
- [x] Generate `specs/backend-execution-engine-refactoring/compact.md`
- [ ] Recommend `/compact` before Phase 4.
