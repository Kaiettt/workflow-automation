# Real-Time Execution Monitoring

## Problem statement

The platform can already start a workflow run asynchronously through the execution queue and persist the final execution and node results in PostgreSQL, but the current UX still behaves like a batch operation. The Run flow is designed around a completion response and a one-time fetch, not a live monitor. In the current implementation, node logs are created only after a node finishes, so the platform cannot show a node as `RUNNING` while it is executing. This makes it difficult to understand active progress, diagnose stalls, and inspect in-flight work from the workflow canvas.

The feature should provide a live monitoring experience that keeps the workflow canvas as the primary surface while letting users review recent executions and inspect active or historical runs without forcing a page refresh.

## Goals

- Start a workflow execution and immediately observe its lifecycle.
- Display execution status in real time while the job is queued and running.
- Show the active node and the state of each node on the workflow canvas.
- Allow the user to inspect historical executions and compare outcomes.
- Preserve the existing async execution model based on PostgreSQL + BullMQ/Redis.
- Expose the live state through a backend event stream without coupling the engine directly to HTTP or SSE.
- Keep the server authoritative for status and node logs; treat the frontend as a consumer of state changes.

## Non-goals

- A dedicated monitoring microservice.
- Kafka or a separate event store.
- Execution cancellation in the first version.
- Advanced analytics, tracing, or dashboards beyond the workflow canvas and execution details.
- Reworking the underlying workflow execution engine beyond the minimal needed to surface in-flight state.

## User stories

1. As a workflow owner, I can click Run and immediately see the newly created execution selected in the history panel.
2. As a workflow owner, I can watch the execution status move from queued to running to success or failure.
3. As a workflow owner, I can see which node currently runs on the canvas and inspect its input, output, and errors.
4. As a workflow owner, I can switch to a historical execution and inspect its final persisted state without opening a live stream.
5. As a workflow owner, I can recover from temporary network interruptions and continue observing an active execution after reconnecting.
6. As a workflow owner, I can only view execution and event data that I own and I must not inspect another user’s execution.

## Functional requirements

### Execution monitoring

1. The platform must support starting a workflow execution and immediately returning a tracked execution resource with a unique ID.
2. After a successful start, the frontend must automatically select the new execution in the history list and begin its monitoring flow.
3. The UI must show overall execution status, queued/running/success/failed states, and timestamps for start and finish.
4. The user must be able to switch between the currently running execution and historical executions without losing context.
5. The system must display execution duration and finish time when available.

### Node monitoring

6. Each node must have a lifecycle state of `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`, or `SKIPPED`.
7. The workflow canvas must highlight the node currently being executed.
8. The node inspector must show status, start time, duration, input, output, and error information when applicable.
9. If a node is skipped because no incoming edge activated, the canvas must render that node as `SKIPPED` rather than `PENDING`.
10. The platform must reflect node status changes without requiring a manual refresh.

### Connection and resilience

11. The frontend must display a connection state such as connected, reconnecting, or disconnected.
12. When the network is temporarily interrupted, the system must reconnect the execution stream and synchronize the latest persisted state.
13. If the backend has already moved the execution to a terminal state while the client is disconnected, the frontend must reconcile the final state after reconnecting.
14. The SSE connection must close when the execution reaches a terminal state or when the user leaves the monitoring view.

### Security

15. Execution event streams must require authentication and authorization.
16. A user must not be able to read or subscribe to another user’s execution stream or execution snapshot.
17. Event payloads must avoid leaking sensitive data that is not already available through the execution read API.
18. Tokens must not be embedded into query strings for SSE connections.

### Error handling

19. If execution creation fails, the UI must show the failed request and keep the workflow canvas in a stable state.
20. If an execution snapshot is unavailable, the UI must show the error state and stop the live stream instead of retrying indefinitely.
21. Duplicate or stale events must be ignored or merged without creating conflicting node state.
22. When a user navigates away from the monitoring view, all active subscriptions and listeners must be cleaned up.

## Non-functional requirements

- The execution engine must remain the source of truth; the event stream is a delivery mechanism, not an alternate system of record.
- Persisted state must be written before the corresponding event is published.
- The monitoring flow must remain compatible with the existing monolith and Redis/BullMQ architecture.
- The initial version must not require Kafka, a new monitoring service, or a dedicated event store.
- Event payloads must be small and structured so the browser can update the local React Query cache efficiently.
- The monitoring behavior must degrade gracefully when the backend is temporarily unavailable.

## Execution lifecycle

Current lifecycle:

- `QUEUED` when the execution record is created and the job is accepted by the queue.
- `RUNNING` when the BullMQ worker claims the job and starts processing.
- `SUCCESS` or `FAILED` after the engine finishes execution and persists the terminal state.

The monitoring feature extends this lifecycle with observable in-flight node transitions:

- `execution.queued`
- `execution.started`
- `node.started`
- `node.completed`
- `node.failed`
- `node.skipped`
- `execution.completed`
- `execution.failed`

The event stream is about visibility; the underlying persistence still decides the authoritative status.

## Node lifecycle

The expected in-flight lifecycle is:

`PENDING -> RUNNING -> SUCCESS | FAILED`

For a node that is not activated by incoming data, the lifecycle becomes:

`PENDING -> SKIPPED`

The implementation must not rely on the final node log alone to signal activity. The system must persist a node state record in the `RUNNING` state before executing the node and then update that same record when the node finishes. This avoids creating duplicate node-log rows for each transition while giving the monitoring flow a reliable active-state indicator.

## UI and UX behavior

The monitoring experience should keep the workflow canvas as the centerpiece while using a three-panel layout:

### Left panel: execution history

- Recent executions ordered by newest first.
- Each execution shows ID, status, queued/start time, and duration.
- Selecting an execution loads its snapshot and current node state.
- Newly created executions are automatically selected after the Run action returns.

### Center panel: workflow canvas

- Shows the current workflow definition with node statuses mapped from persisted results and live events.
- Highlights the currently active node in a distinct visual treatment.
- Uses color or style variations for `SUCCESS`, `RUNNING`, `FAILED`, `SKIPPED`, and `PENDING` states.
- Updates in real time as events arrive.

### Right panel: node details

- Shows the selected node’s Status, start time, duration, input, output, and failure message.
- Supports Input, Output, and Logs tabs as appropriate to the node type.
- Shows details consistent with the persisted execution data and any live event payloads.

## API behavior

### Start execution

- `POST /api/executions` remains the entry point for manual execution.
- Response remains an accepted execution resource with `202 Accepted` and the execution ID.
- The frontend selects the returned execution immediately after acceptance.
- The backend stores the execution as `QUEUED` before enqueuing, and then the worker advances it to `RUNNING`.

### Execution snapshot

- `GET /api/executions/:executionId` remains the authoritative snapshot endpoint.
- It returns the execution metadata, timestamps, node logs, and current status.
- The frontend should fetch the snapshot before or while establishing the SSE stream.

### SSE contract

- Endpoint: `GET /api/executions/:executionId/events` or equivalent authenticated stream endpoint.
- The stream emits JSON event frames with a `type` and `payload` fields.
- Each event includes a `executionId`, times, and relevant data.
- Event payloads are intentionally lightweight and omit full large payloads when they can be fetched on demand.
- The stream closes when the execution reaches a terminal state or the client disconnects.

Example event shapes:

```json
{
  "event": "node.started",
  "executionId": "<uuid>",
  "nodeId": "<node-id>",
  "nodeKey": "gmail.send",
  "status": "RUNNING",
  "ts": "2026-11-08T12:00:00.000Z"
}
```

```json
{
  "event": "execution.completed",
  "executionId": "<uuid>",
  "status": "SUCCESS",
  "finishedAt": "2026-11-08T12:00:02.000Z",
  "durationMs": 2000
}
```

## Error scenarios

- The Run request fails because the version is invalid or unauthorized.
- The execution snapshot endpoint returns 404 or 403 because the execution is missing or not owned by the current user.
- The SSE connection fails due to a network drop or server restart.
- Duplicate or stale events arrive after reconnect.
- The worker updates the execution to a terminal state before the browser has reconnected.
- The browser leaves the monitoring page while the execution is still running.

## Testing principles and quality gates

This feature must be implemented using a test-first workflow and real-behavior verification. The goal is not to assert on mocks or fake state, but to validate the actual execution lifecycle and the real browser/user flow.

### Required test strategy

1. Backend behavior tests must use the real execution repository, PostgreSQL-backed persistence, and the actual BullMQ worker flow where practical.
2. Frontend tests must validate actual query updates, stream lifecycle behavior, and rendered canvas state instead of mock-only DOM assertions.
3. Each feature requirement must map to at least one test case with a clear setup, trigger, expected outcome, and cleanup.
4. The implementation must pass a red-green-refactor cycle for each changed behavior: write a failing test, implement the minimal fix, verify the result, then refactor only if needed.

### Minimum required test suites

- Unit tests for `WorkflowEngine` and `NodeRunner`:
  - a node starts in `RUNNING` before executing
  - a successful node persists `SUCCESS` and output
  - a failed node persists `FAILED` and error metadata
  - a skipped node persists `SKIPPED`
- Repository tests for persistence semantics:
  - one node log row is reused across state changes
  - execution finalization updates `finishedAt` and `durationMs`
  - stale or failed executions are marked correctly
- Integration tests for queue and execution processing:
  - `QUEUED -> RUNNING -> SUCCESS/FAILED`
  - duplicate job delivery does not duplicate external effects
  - queue failures leave no zombie execution in `QUEUED`
- SSE/auth tests:
  - authenticated client receives events in order
  - unauthorized client gets 403/404
  - subscription cleanup occurs on disconnect
  - reconnect does not duplicate the latest state
- Frontend tests:
  - Run creates a selected execution and immediately starts monitoring
  - cache updates correctly after event arrival
  - historical execution inspection remains available without an active stream
  - connection status renders connected/reconnecting/disconnected states

### Test failure criteria

The feature is not complete if any of the following remain untested:

- execution lifecycle transitions across the worker boundary
- node-level `RUNNING` persistence before completion
- subscription authorization and cleanup
- duplicate or stale event handling
- frontend query synchronization after reconnect

## Acceptance criteria

1. A user can start a workflow execution and immediately see the newly created execution selected.
2. The execution history panel shows lifecycle states and timestamps without requiring a page refresh.
3. The canvas shows `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`, and `SKIPPED` states and highlights the active node.
4. The node details panel shows the active node’s data, duration, and error information when available.
5. The app updates node status through SSE events and syncs the React Query cache accordingly.
6. Reconnecting to the stream after a temporary disconnect restores the current execution state.
7. Historical executions remain inspectable without an active stream.
8. Unauthorized users cannot access execution snapshots or event streams.
9. The platform does not leak bearer tokens via URL query strings.
10. The system does not create duplicate node-log records for each state transition.

## Definition of done

This feature is considered complete when the execution lifecycle is visible to the user in real time, the monitoring flow works for newly created and historical executions, the system remains secure, and the final behavior is covered by tests for the execution lifecycle and the streaming client behavior.
