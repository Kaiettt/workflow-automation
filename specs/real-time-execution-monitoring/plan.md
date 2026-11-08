# Real-Time Execution Monitoring Plan

## Overall implementation strategy

The implementation should be incremental and should build on the existing execution lifecycle instead of replacing it. The plan is to make the execution engine observable, then expose that state through a lightweight event stream, and finally wire the frontend to the canonical execution snapshot and live events.

The project already has the core pieces:

- execution records persisted in PostgreSQL
- BullMQ queue processing for background runs
- a workflow engine that coordinates node execution and writes node logs
- React Query hooks and a feature-scoped execution service layer

The work is therefore mostly about adding visibility rather than rewriting the engine.

## Phase 1: make in-flight node state observable

### Scope

- Add the persisted `RUNNING` status for a node before the node starts executing.
- Update the same node log row on completion or failure instead of creating duplicate rows.
- Keep the execution record authoritative for the overall lifecycle.

### Dependencies

- `WorkflowEngine`
- `NodeRunner`
- `ExecutionRepository`
- `ExecutionNodeLog` persistence behavior

### Deliverable

A running node is visible in persisted state before its result is final, which is the key prerequisite for the live canvas.

## Phase 2: backend execution event publishing

### Scope

- Introduce an execution event abstraction behind a port or interface.
- Publish lifecycle events for queue, execution, node start/completion/failure, and terminal states.
- Ensure persisted writes happen before events are emitted.
- Keep events lightweight and domain-specific.

### Dependencies

- Phase 1 persistence changes
- `ExecutionProcessor`
- `WorkflowEngine`
- repository/engine integration points

### Deliverable

The backend can publish a consistent event stream without coupling the execution domain to HTTP or to a specific transport.

## Phase 3: SSE API and authorization

### Scope

- Add an authenticated stream endpoint for execution events.
- Verify execution ownership before allowing a subscription.
- Register and clean up client subscriptions.
- Handle reconnection and closure by terminal state.

### Dependencies

- Phase 2 event publisher
- JWT auth guard and owner verification logic
- execution read routes and ownership constraints

### Deliverable

Clients can subscribe to a specific execution and receive updates without polling the entire execution resource repeatedly.

## Phase 4: frontend monitoring integration

### Scope

- Add execution monitoring hooks and services.
- Keep `selectedExecutionId` separate from `selectedNodeId`.
- Automatically select newly created executions after `Run`.
- Fetch the initial execution snapshot before or while establishing the SSE connection.
- Synchronize the React Query cache rather than storing ad hoc state in component-local memory.

### Dependencies

- execution service layer and API patterns already in use for `useExecution` and `useExecutionHistory`
- workflow canvas node mapping utilities
- execution history UI components

### Deliverable

The monitoring page behaves like a live execution dashboard using the existing React Query infrastructure.

## Phase 5: canvas and details UI

### Scope

- Update the workflow canvas to render node state as `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`, and `SKIPPED`.
- Highlight the active node.
- Display input/output and node metadata in the right panel.
- Keep historical and live execution inspection separately but consistent.

### Dependencies

- execution state mapping utilities
- workbook or canvas node rendering components
- execution history and details panels

### Deliverable

The user can monitor the workflow visually and inspect the chosen node without leaving the canvas-based workflow page.

## Phase 6: reliability, reconnect logic, and test hardening

### Scope

- Add reconnect handling and stale-event filters.
- Ensure snapshots reconcile with terminal states reached while disconnected.
- Verify unauthorized stream access is blocked.
- Cover edge cases such as duplicate payloads and navigation cleanup.

### Dependencies

- all earlier phases
- frontend and backend test suites

### Deliverable

The system remains correct in the presence of browser disconnects, remote restarts, and duplicate event deliveries.

## Implementation order

Recommended order:

1. Persist running node state before execution.
2. Publish backend execution events after state writes.
3. Expose authenticated SSE routes.
4. Add frontend execution monitoring hooks and cache reconciliation.
5. Upgrade the canvas and details panels.
6. Add reconnect, stale-event, and cleanup hardening.

This order minimizes risk because it establishes a reliable state source before adding live transport.

## Testing strategy and quality gates

The implementation should follow a strict TDD workflow with verification against real behavior. Testing is not optional and must be planned alongside each phase; all implementation tasks should be backed by failing tests before the fix is accepted.

### Test principles

- Prefer the real repository, queue, and execution flow over mocks whenever the behavior depends on persistence or lifecycle ordering.
- Never write assertions that only prove a mocked publisher or mocked component was called; the test must verify the persisted state or rendered UI behavior.
- For all user-visible flows, test the actual contract: starting a run, selecting it, receiving stream updates, and reconciling the state on reconnect.

### Backend tests

- Unit tests for node lifecycle transitions: `PENDING -> RUNNING -> SUCCESS/FAILED`.
- Repository tests verifying the same node-log row is updated instead of duplicated.
- Execution processor tests confirming state transitions and terminal-state publishing.
- Authorization tests for stream access and ownership enforcement.
- Regression tests for stale execution cleanup and failed queue jobs.

### Frontend tests

- Hook tests for the execution snapshot and SSE reconnection behavior.
- Cache synchronization tests ensuring `selectedExecutionId` and the execution query update consistently.
- Component tests for the history panel, the canvas state mapping, and the node details panel.
- Browser-logic tests for reconnect, terminal-state closure, and graceful fallback to snapshot refresh.

### Integration tests

- Start a run, connect to SSE, and observe node lifecycle events in order.
- Simulate a temporary disconnect and verify a reconnect resynchronizes the latest state.
- Confirm that historical executions remain available without a live connection.
- Verify that a non-owner cannot subscribe or inspect another user’s execution.

### Quality gate checklist before merge

Each phase must pass:

1. failing test written first
2. minimal implementation completes the behavior
3. focused backend/frontend suite passes
4. regression check for the adjacent flow passes
5. no mock-only assertions remain in the critical path

This gate ensures the monitoring feature meets quality standards instead of relying on ad hoc reasoning or incomplete verification.
## Risks and mitigation

### Risk: broken event ordering

Mitigation: persist node state before publish and treat the persisted row as the actual source of truth. Publish only after the database write succeeds.

### Risk: duplicate or stale events after reconnect

Mitigation: include timestamps and ignore older state transitions; re-fetch the snapshot after a reconnect to reconcile with the server-authoritative state.

### Risk: auth mismatch between API and SSE

Mitigation: do not rely on `EventSource` with bearer headers; use a same-site secure cookie or a short-lived stream token tied to the authenticated session.

### Risk: over-engineering the first version

Mitigation: keep the event abstraction internal, start with in-memory publishing, and defer Redis Pub/Sub until it is genuinely needed for multi-instance deployment.

## Recommended milestone checkpoint

The feature is ready for review after the execution engine can persist node `RUNNING` state, the backend emits events for each node lifecycle change, and the frontend can show a live canvas using a selected execution snapshot plus stream updates. That checkpoint ensures the implementation is aligned with the long-term architecture without requiring a large migration.
