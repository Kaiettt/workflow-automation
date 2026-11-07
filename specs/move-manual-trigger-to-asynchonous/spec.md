# Asynchronous Manual Execution Specification

## Status

Proposed. This document describes a migration plan, not an implemented behavior.

## Problem

Manual execution currently runs inside the HTTP request. `StartExecutionHandler`
creates a `MANUAL` execution, stores it as `RUNNING`, calls `WorkflowEngine.run()`
and returns the completed result. The request therefore stays open for the full
workflow duration. Webhook execution already creates a `QUEUED` execution and
hands it to BullMQ, where `ExecutionProcessor` runs the same engine.

The designer's Run action waits for that completed result before it updates the
canvas and shows logs. It stores only one result in component state, so reload
loses the selected run and its details.

## Goal

Manual runs of a published workflow version are accepted quickly and executed by
the existing BullMQ worker. The API returns an execution resource with an ID and
`QUEUED` status. The persisted execution and its node logs remain the source of
truth for status, results, and history.

## Verified Current Behavior

- `POST /api/executions` is the only route in `ExecutionController`. It returns
	HTTP 201 and a completed result envelope.
- `StartExecutionHandler` checks version ownership and validates the graph before
	creating an execution. It records `MANUAL`, the authenticated actor, and empty
	trigger items, then executes synchronously.
- `EnqueueExecutionHandler` currently handles webhook runs. It records
	`WEBHOOK`, `QUEUED`, the trigger items in execution context, and enqueues a
	job containing `executionId`, `workflowVersionId`, `triggerItems`, and
	`queuedAt`.
- `BullMqExecutionQueue` uses the `executions` queue and `executionId` as the
	BullMQ `jobId`. The queue is configured for one attempt and retains the most
	recent 1000 completed and failed jobs.
- `ExecutionProcessor` atomically claims only `QUEUED` executions, loads the
	pinned workflow version, and invokes `WorkflowEngine.run()`. Worker failures
	mark unfinished executions `FAILED`; `maxStalledCount: 0` prevents replaying a
	job whose nodes may have performed external side effects.
- `WorkflowEngine` persists final status, finish time, duration, and per-node
	logs. `NodeRunner` produces a final log after a node completes; the active node
	is not currently persisted as `RUNNING` during execution.
- `PrismaExecutionRepository.findExecutionResult()` returns status, timestamps,
	duration, and ordered node logs. No execution GET or history endpoint exists,
	and that query does not enforce owner authorization.
- `Execution` already pins `workflowVersionId`, stores trigger context, and has
	an indexed workflow/start-time pair. Prisma already defines `CANCELLED`, but
	the TypeScript execution enum and worker do not support it.
- The version Run page stores one result in React component state. It already
	renders result status, duration, execution ID, expandable input/output/error
	logs, and a React Flow canvas. It maps logs to node states only after the POST
	completes. React Query is already used for server state elsewhere in the
	feature; execution has only a start mutation today.

## Functional Requirements

### Start and execute

1. An authenticated owner can start a manual run for a published version they
	 own. The request must retain the current version ownership and graph
	 preflight checks.
2. The accepted run is persisted as `QUEUED` before being enqueued. The API does
	 not invoke `WorkflowEngine.run()`.
3. Manual runs use `TriggerType.MANUAL`, the requesting user as
	 `triggeredById`, and an empty trigger item list, preserving current manual
	 trigger behavior.
4. The queue job references the immutable published `workflowVersionId`; the
	 worker must not use a mutable draft or a later published version.
5. Manual and webhook runs use the same execution queue, processor, engine, and
	 persistence lifecycle. Trigger-specific validation and input creation stay
	 outside the engine.
6. A successful start returns an execution ID and `QUEUED` status without
	 waiting for node execution.
7. A queue enqueue failure must not leave the execution indefinitely `QUEUED`.
	 A worker crash must not replay side-effecting node work automatically.
8. Repeated delivery of one queue job must not execute a run twice. Repeated
	 HTTP submissions with the same idempotency key must return the original
	 execution rather than create another side-effecting run.

### Read and monitor

9. An authorized user can retrieve one execution by ID and receive its current
	 status, timing, workflow/version identifiers, and node logs.
10. An authorized user can list executions for a workflow/version in newest-first
		order, with bounded pagination, and select any run to inspect.
11. Execution reads must verify the caller owns the workflow. Unknown and
		unauthorized resources should not disclose whether another owner's
		execution exists; use the repository's existing not-found/forbidden policy.
12. The designer restores a selected active execution after refresh and stops
		polling after `SUCCESS`, `FAILED`, or `CANCELLED`.
13. Queued nodes are shown as pending. Persisted node logs determine success,
		failure, and skipped states. Do not label a node as actively running unless
		the backend exposes that progress.
14. The UI displays overall status, queue wait/start/finish timing when
		available, duration, execution ID, node logs, outputs, and errors.

### Cancellation scope

15. Cancellation is not part of the minimum migration. The UI must not offer a
		Cancel control until a worker-safe cancellation protocol exists. `CANCELLED`
		remains a future lifecycle state; it is not implied by the enum's presence
		in Prisma.

## API Contract

### Start a manual execution

`POST /api/executions`

Headers:

```http
Authorization: Bearer <access-token>
Idempotency-Key: <client-generated-unique-key>
```

Request:

```json
{
	"workflow_version_id": "<uuid>"
}
```

Accepted response: HTTP `202 Accepted`.

```json
{
	"success": true,
	"data": {
		"id": "<execution-uuid>",
		"workflowId": "<workflow-uuid>",
		"workflowVersionId": "<version-uuid>",
		"triggerType": "MANUAL",
		"status": "QUEUED",
		"queuedAt": "<ISO-8601 timestamp>",
		"startedAt": null,
		"statusUrl": "/api/executions/<execution-uuid>"
	}
}
```

The same idempotency key and same request returns the same execution resource.
Reusing the key with a different version/request returns HTTP `409 Conflict`.
Missing or malformed version data is `400`; missing version is `404`; a version
not owned by the caller follows existing authorization behavior. Redis/queue
failure returns a server error and the recorded execution is transitioned to
`FAILED` with a safe error reason.

### Read one execution

`GET /api/executions/:executionId`

HTTP `200`, same `{ success, data }` envelope. Include ordered `nodeLogs`; fields
include `id`, `workflowId`, `workflowVersionId`, `triggerType`, `status`,
`queuedAt`, `startedAt`, `finishedAt`, `durationMs`, and for each log `nodeId`,
`nodeKey`, `status`, `input`, `output`, `errorMessage`, `startedAt`,
`finishedAt`, and `durationMs`.

The first version can return all logs. If output size grows, add a summary mode
and a paginated log detail route without changing the execution identity.

### List workflow executions

`GET /api/workflows/:workflowId/executions?workflow_version_id=<uuid>&limit=20&cursor=<opaque>`

HTTP `200`, `{ success, data: { items, nextCursor } }`. List summaries omit
large input/output bodies and are ordered by `queuedAt` (or the chosen accepted
timestamp) descending, then ID for stable pagination. The version filter is
optional; the page may default to the currently viewed published version.

No status route is needed separately: the GET-by-ID resource is the status and
result endpoint. No cancel route is included in this migration.

## User Flow

1. On the published version page, the user selects Run. The client creates an
	 idempotency key for this intentional submission and disables only duplicate
	 submission while the POST is in flight.
2. On `202`, the page selects the returned execution, shows `QUEUED`, initializes
	 its canvas as pending, and starts status polling. The submission spinner ends
	 when the server accepts the run, not when the workflow finishes.
3. While `QUEUED`, show that the run is waiting. While `RUNNING`, show overall
	 progress and apply newly persisted node logs to the canvas/log table.
4. On terminal status, stop polling and show the final duration, node details,
	 and outcome. Selecting an older execution replaces the inspector data and
	 canvas state without starting another run.
5. On reload, restore the selected execution from the URL query parameter or
	 session storage, fetch its execution resource, and resume polling if active.

## Acceptance Criteria

- Manual start responds with HTTP 202 and `QUEUED` before the worker finishes.
- Manual and webhook jobs reach the same processor and engine with correct
	trigger type, actor, and item context.
- The database history remains pinned to the published version used at start.
- Known queue failures transition the execution out of `QUEUED`; worker failures
	become `FAILED`; duplicate job delivery does not repeat external effects.
- Status and result reads are owner-authorized and survive browser refresh.
- The designer can switch among multiple executions and render persisted node
	logs accurately.
- No cancellation control is shown until cancellation is implemented end to
	end.
- Existing synchronous execution API tests are revised to assert acceptance
	and then poll for terminal state; workflow engine behavior remains covered.

## Out of Scope

- Editing or running an unpublished draft.
- Arbitrary manual trigger input payloads. The current request accepts only a
	published version ID and manual runs start with empty trigger items.
- WebSocket/SSE transport, automatic retries of failed side-effecting jobs,
	distributed workers, and microservices.
- Execution retention/archival policy changes.
- Cancellation until execution nodes can cooperatively stop and external side
	effects have well-defined cancellation semantics.
