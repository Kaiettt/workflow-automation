# Real-Time Execution Monitoring Tasks

## General test rules for all tasks

- Every task must start with a failing test covering the required behavior.
- Tests must validate real persisted state or actual rendered UI, not mock-only interaction.
- The task is not done until the relevant focused backend or frontend suite passes.
- Regressions in adjacent execution flows must be checked before merging.

## Phase 0: Test harness and fixtures

### Task 0.1 — Establish the execution monitoring TDD baseline
- Description: Create the shared fixtures and test helpers used for execution lifecycle, SSE, and frontend cache tests so each task can be worked in a red-green-refactor cycle.
- Expected outcome: A consistent baseline of test data and helpers is available for backend and frontend verification.
- Relevant modules: backend test support, frontend feature tests, execution fixtures.
- Dependencies: None.
- Test requirements: Fixture tests confirm the execution and node data can be created in a realistic state and reused across suites.
- Completion criteria: A valid execution fixture and helper set exists and is used by the monitoring test suites.

## Phase 1: Execution lifecycle and persistence

### Task 1.1 — Add a node RUNNING state before execution
- Description: Ensure each node has a persisted lifecycle record in `RUNNING` before its work begins. This applies to both the queued and worker-executed path, and it should be the same data model used for final node results.
- Expected outcome: A node log exists in the persisted data model before the node body executes, so the live monitoring flow does not depend on a post-hoc result row.
- Relevant modules: `monolith-backend/libs/execution/src/application/services/workflow-engine.ts`, `monolith-backend/libs/execution/src/application/services/node-runner.ts`, `monolith-backend/libs/execution/src/infrastructure/persistence/prisma-execution.repository.ts`
- Dependencies: None.
- Test requirements: Unit tests verifying `RUNNING` is persisted before execution and the node log is updated on completion/failure.
- Completion criteria: A unit test proves that running nodes are visible in the database before they finish.

### Task 1.2 — Update the node log instead of duplicating rows
- Description: Replace any pattern that writes a separate row for each lifecycle transition with a single row per node execution that is updated in place.
- Expected outcome: `node.started`, `node.completed`, and `node.failed` map to the same execution node log row with a consistent identity.
- Relevant modules: `ExecutionRepository`, `PrismaExecutionRepository`, node-runner execution logic.
- Dependencies: Task 1.1.
- Test requirements: Repository-level tests verifying idempotent upsert/update semantics and no duplicate `ExecutionNodeLog` rows for one node execution.
- Completion criteria: A single persisted row captures the node lifecycle from start to completion.

### Task 1.3 — Keep the execution status authoritative
- Description: Confirm the overall execution lifecycle remains `QUEUED -> RUNNING -> SUCCESS/FAILED` with the worker and repository handling terminal transitions.
- Expected outcome: The execution record remains the source of truth for whether an execution is complete.
- Relevant modules: `ExecutionProcessor`, `ExecutionRepository`, `WorkflowEngine.run()`.
- Dependencies: Task 1.1.
- Test requirements: Worker and repository tests for queue claim, stale failure handling, and terminal-state persistence.
- Completion criteria: Execution completion logic still passes the existing async execution tests without regressions.

## Phase 2: backend event publishing

### Task 2.1 — Define an execution event contract
- Description: Define the event names, payload fields, ordering expectations, and idempotency rules for execution and node lifecycle events.
- Expected outcome: A clear event contract for `execution.queued`, `execution.started`, `node.started`, `node.completed`, `node.failed`, `node.skipped`, `execution.completed`, and `execution.failed`.
- Relevant modules: design and execution application layer.
- Dependencies: Phase 1.
- Test requirements: Contract tests verifying event names and payload keys.
- Completion criteria: Event contract is documented and validated in implementation tests.

### Task 2.2 — Introduce the execution event publisher abstraction
- Description: Add a small transport-agnostic execution event interface so the engine does not depend on HTTP transport or a specific implementation.
- Expected outcome: Domain logic emits events through a publisher interface rather than directly touching the controller or the browser stream.
- Relevant modules: execution application and infrastructure layers.
- Dependencies: Task 2.1.
- Test requirements: Unit tests that mock the publisher and verify events are emitted at the right lifecycle points.
- Completion criteria: The publisher is injected and all node and execution lifecycle transitions route through it.

### Task 2.3 — Publish events only after successful persistence
- Description: Enforce ordering so database writes occur before corresponding events are emitted.
- Expected outcome: The stream and cache are updated only when the persisted state is already correct.
- Relevant modules: `WorkflowEngine`, `NodeRunner`, `ExecutionRepository`, event publisher bridge.
- Dependencies: Task 2.2.
- Test requirements: Tests verifying event publication is gated on successful persistence.
- Completion criteria: No event can claim a state transition that was not persisted first.

## Phase 3: SSE API and authorization

### Task 3.1 — Add an authenticated execution stream endpoint
- Description: Expose a stream endpoint that serves execution and node events over Server-Sent Events and requires authentication.
- Expected outcome: An authenticated client can connect to a stream for one execution.
- Relevant modules: backend HTTP presentation layer and auth guard integration.
- Dependencies: Task 2.3.
- Test requirements: Controller tests verifying the endpoint requires auth and returns stream headers.
- Completion criteria: Stream endpoint is protected by the existing JWT guard and rejects unauthenticated access.

### Task 3.2 — Verify execution ownership for stream subscriptions
- Description: Enforce that only the workflow owner can subscribe to an execution stream or read an execution snapshot.
- Expected outcome: Unauthorized access returns the project’s existing forbidden/not-found semantics.
- Relevant modules: execution query layer, event subscription setup.
- Dependencies: Task 3.1.
- Test requirements: Tests for owner and non-owner access to stream and snapshot APIs.
- Completion criteria: A non-owner cannot subscribe to a stream for another user’s execution.

### Task 3.3 — Manage stream lifecycle and cleanup
- Description: Register active subscriptions keyed by execution ID and remove them when the client disconnects or the execution reaches a terminal state.
- Expected outcome: The backend does not leak subscriptions after disconnects or terminal events.
- Relevant modules: SSE stream controller, subscription registry, lifecycle cleanup logic.
- Dependencies: Task 3.1.
- Test requirements: Tests for disconnect cleanup and terminal-state closure.
- Completion criteria: A disconnected client is removed from the subscription registry and no long-lived stream remains active.

## Phase 4: frontend execution monitoring integration

### Task 4.1 — Add execution monitoring service and hooks
- Description: Add a service layer and React Query hooks for execution snapshots, history, and stream subscriptions.
- Expected outcome: The frontend can fetch the current execution and keep it in the query cache.
- Relevant modules: `frontend/src/features/workflow/services/execution.service.ts`, `frontend/src/features/workflow/hooks/useExecution.ts`, and related query hooks.
- Dependencies: existing execution API routes.
- Test requirements: Hook tests for the snapshot fetch and terminal-state stop conditions.
- Completion criteria: Snapshot reads and status polling continue to work without breaking the existing flow.

### Task 4.2 — Manage selected execution state separately from selected node state
- Description: Ensure `selectedExecutionId` and `selectedNodeId` are tracked independently and the current execution can be selected immediately after Run.
- Expected outcome: The history list and canvas inspector can represent a live execution and its selected node without collision.
- Relevant modules: workflow feature page state and execution history components.
- Dependencies: Task 4.1.
- Test requirements: UI tests for selection behavior after start and switching between executions.
- Completion criteria: A new run is automatically selected and the selected node remains predictable when the execution changes.

### Task 4.3 — Establish the initial snapshot and SSE connection flow
- Description: Fetch the execution snapshot before or while connecting the SSE stream and update the query cache after the first event batch.
- Expected outcome: The frontend sees initial state and avoids missing updates during connect.
- Relevant modules: execution monitoring hooks and service layer.
- Dependencies: Task 4.1, Task 3.1.
- Test requirements: Reconnection tests and sync tests for stream start order.
- Completion criteria: A stream connects after a valid snapshot and does not lose the current execution state.

## Phase 5: workflow canvas and node details UI

### Task 5.1 — Map execution data onto the workflow canvas
- Description: Convert persisted execution node logs and live events into node states for the workflow canvas.
- Expected outcome: Nodes render as `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`, or `SKIPPED`.
- Relevant modules: canvas node state mapping utilities and workflow page rendering.
- Dependencies: Task 4.3.
- Test requirements: Unit and component tests for mapping persisted data to visualization states.
- Completion criteria: The canvas reflects current execution state without requiring a page refresh.

### Task 5.2 — Highlight the active node and show execution status in context
- Description: Add an active-node highlight and display the execution status in the monitor header or canvas container.
- Expected outcome: The user sees which node is running and how the full execution is progressing.
- Relevant modules: workflow canvas and execution status UI blocks.
- Dependencies: Task 5.1.
- Test requirements: UI tests verifying the active-node style and status badge updates.
- Completion criteria: The monitor distinguishes running work from historical state clearly.

### Task 5.3 — Build the node details panel
- Description: Show node status, duration, input, output, and errors in the right panel for the selected node.
- Expected outcome: The selected node provides all relevant details to diagnose execution results.
- Relevant modules: node inspector panel and related UI utilities.
- Dependencies: Task 5.1.
- Test requirements: Component tests for input, output, and error states.
- Completion criteria: The node inspector works for both live and historical nodes.

## Phase 6: reliability, cleanup, and validation

### Task 6.1 — Handle reconnect and stale event scenarios
- Description: Ensure SSE reconnection and duplicate or stale event payloads are handled without corrupting the execution state.
- Expected outcome: Reconnects reconcile with the server and stale events are ignored.
- Relevant modules: SSE client and query-state synchronization logic.
- Dependencies: Task 4.3.
- Test requirements: Reconnect and stale-event tests.
- Completion criteria: Temporary network loss does not leave the app stuck in a stale or invalid state.

### Task 6.2 — Handle browser navigation and cleanup
- Description: Stop active streams when a user leaves the monitoring view and clean up all listeners and connection state.
- Expected outcome: No background stream continues after the user navigates away.
- Relevant modules: frontend monitor hooks and lifecycle cleanup in page components.
- Dependencies: Task 4.3.
- Test requirements: Hook tests for unmount cleanup and navigation resets.
- Completion criteria: Leaving the page stops the monitoring stream and query updates.

### Task 6.3 — Validate auth, security, and final regression coverage
- Description: Verify that auth and ownership checks are enforced for both snapshots and SSE, then run the backend and frontend tests for the monitoring flow.
- Expected outcome: The monitoring feature meets the security and reliability requirements.
- Relevant modules: backend auth + execution APIs, frontend monitoring hooks and UI tests.
- Dependencies: all prior tasks.
- Test requirements: End-to-end tests for execution start, live updates, stale reconnects, and unauthorized access rejection.
- Completion criteria: Public-facing acceptance criteria are satisfied and the monitoring flow remains stable under normal and degraded conditions.

## Notes

- This task list intentionally avoids broad refactoring. The work stays centered on the existing execution domain and frontend monitoring patterns already used in the repo.
- The core value is to make the current asynchronous execution lifecycle observable without replacing the execution engine or introducing a separate monitoring service.
