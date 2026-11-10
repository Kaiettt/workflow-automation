# Implementation Plan: Decouple Workflow Execution Engine & Node Runner

## Overview
Deconstruct `NodeRunner` and `WorkflowEngine` into single-responsibility components and register them with NestJS Dependency Injection.

---

## Phase 1: Extract Collaborators (`NodeExecutionObserver` & `NodeConfigResolver`)

### Tasks
1. Create `monolith-backend/libs/execution/src/application/services/node-execution-observer.ts`:
   - Move `saveNodeLog` and `publishExecutionEventSafely` calls from `NodeRunner` and `WorkflowEngine`.
   - Add unit tests in `test/unit/execution/node-execution-observer.spec.ts`.
2. Create `monolith-backend/libs/execution/src/application/services/node-config-resolver.ts`:
   - Move credential resolution (`resolveCredential`), expression context assembly (`createExpressionContext`), and schema defaults parsing (`applySchemaDefaults`).
   - Add unit tests in `test/unit/execution/node-config-resolver.spec.ts`.

---

## Phase 2: Extract Execution Strategies (`OnceStrategy` & `PerItemStrategy`)

### Tasks
1. Create `monolith-backend/libs/execution/src/application/services/strategies/once-execution.strategy.ts`:
   - Move single-item execution logic, credential extraction, and output schema assertions.
2. Create `monolith-backend/libs/execution/src/application/services/strategies/per-item-execution.strategy.ts`:
   - Move per-item looping, item cap evaluation (`maxItems`), error summary assembly (`ItemRunError`), and multi-output routing.
3. Write unit tests for both strategies in `test/unit/execution/strategies/`.

---

## Phase 3: Wire NestJS DI & Refactor `WorkflowEngine`

### Tasks
1. Refactor `NodeRunner`:
   - Inject the newly created observer, resolver, and strategies.
   - Reduce `NodeRunner` from 326 lines to < 100 lines.
2. Update `ExecutionModule` (`execution.module.ts`):
   - Register `NodeConfigResolver`, `NodeExecutionObserver`, `OnceExecutionStrategy`, `PerItemExecutionStrategy`, and `NodeRunner` as providers.
3. Refactor `WorkflowEngine`:
   - Inject `NodeRunner` via constructor instead of `new NodeRunner(...)`.
   - Delegate skipped node persistence to `NodeExecutionObserver.notifySkipped`.
4. Run full backend test suite (`npm test` in `monolith-backend/`) and integration tests (`npm run test:e2e`).

