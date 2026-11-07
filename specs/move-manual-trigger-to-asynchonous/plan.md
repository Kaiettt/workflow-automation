# Asynchronous Manual Execution Implementation Plan

## Recommended Order

Implement the work in six phases. Keep the queue and worker shared from the
first phase; do not introduce a second manual-run queue. Land backend lifecycle
and recovery before changing the frontend to poll it.

Priority meaning: `P0` blocks release, `P1` is important hardening or requested
monitoring quality, and `P2` is a future improvement.

## Phase 1: Backend Refactoring and Shared Pipeline

### 1.1 Introduce shared execution start application service

- **Description:** Add an application service that receives a resolved workflow
	version, trigger type, actor ID, trigger items, and idempotency key. It creates
	a `QUEUED` execution, stores normalized trigger context, enqueues the common
	job, and marks the execution failed if enqueue reports an error.
- **Relevant files:**
	`monolith-backend/libs/execution/src/application/commands/start-execution/start-execution.command.ts`,
	`monolith-backend/libs/execution/src/application/commands/enqueue-execution/enqueue-execution.command.ts`,
	`monolith-backend/libs/execution/src/application/services/`,
	`monolith-backend/libs/execution/src/execution.module.ts`.
- **Dependencies:** None.
- **Expected outcome:** A single owner for create/enqueue/failure behavior;
	workflow execution remains in `WorkflowEngine`.
- **Acceptance criteria:** Service tests show both trigger types create QUEUED
	rows and the same job shape; enqueue failure transitions only an unfinished
	row to FAILED; no handler invokes `WorkflowEngine.run()`.
- **Priority:** P0.

### 1.2 Refactor manual and webhook command handlers

- **Description:** Keep manual owner/version/graph validation in
	`StartExecutionHandler`, then call the shared service with `MANUAL`, actor ID,
	and empty items. Keep webhook parsing and listener selection in
	`ReceiveWebhookHandler` and its execution command; make
	`EnqueueExecutionHandler` delegate with `WEBHOOK`, null actor, and parsed
	items. Remove trigger-specific row creation from `WorkflowEngine` if the new
	service owns it.
- **Relevant files:**
	`monolith-backend/libs/execution/src/application/commands/start-execution/start-execution.command.ts`,
	`monolith-backend/libs/execution/src/application/commands/enqueue-execution/enqueue-execution.command.ts`,
	`monolith-backend/libs/execution/src/application/services/workflow-engine.ts`,
	`monolith-backend/libs/triggers/src/application/commands/receive-webhook.command.ts`.
- **Dependencies:** 1.1.
- **Expected outcome:** Trigger policy remains separate; both sources share
	queue lifecycle and cannot diverge in persistence behavior.
- **Acceptance criteria:** Manual command does not await node completion and
	returns the execution ID/resource; webhook job payload and trigger context
	remain unchanged; manual ownership and graph preflight tests still pass.
- **Priority:** P0.

## Phase 2: Queue Integration and Execution Lifecycle

### 2.1 Align persisted status and time semantics

- **Description:** Add `queuedAt`, make `startedAt` nullable until the worker
	claim, persist worker start on atomic claim, and keep `finishedAt` and
	`durationMs` terminal-only. Backfill old `queuedAt` from `startedAt`. Add
	persisted idempotency key and unique actor/key constraint. Add an index for
	workflow execution history ordered by queue acceptance time.
- **Relevant files:**
	`monolith-backend/prisma/schema.prisma`,
	`monolith-backend/prisma/migrations/`,
	`monolith-backend/libs/execution/src/domain/models/execution.types.ts`,
	`monolith-backend/libs/execution/src/domain/constants/execution.constants.ts`,
	`monolith-backend/libs/execution/src/infrastructure/persistence/prisma-execution.repository.ts`.
- **Dependencies:** 1.1.
- **Expected outcome:** Queued wait and actual run duration are represented
	distinctly; retrying the same HTTP intent cannot create another execution.
- **Acceptance criteria:** Migration preserves existing execution data; new
	manual rows are QUEUED with `startedAt = null`; worker claim sets start time;
	duplicate actor/key rows are rejected or resolved to the existing execution.
- **Priority:** P0.

### 2.2 Harden queued job recovery and worker outcomes

- **Description:** Keep the existing `executions` queue, job name, and
	`jobId = executionId`. Add a bounded reconciler for stale QUEUED rows that
	re-enqueues the same idempotent job. Preserve one attempt and atomic claim.
	Review stale RUNNING recovery so a long but healthy execution is not failed
	solely due to age; add lease/heartbeat only if a safe cutoff cannot be
	established.
- **Relevant files:**
	`monolith-backend/libs/execution/src/application/ports/execution-queue.port.ts`,
	`monolith-backend/libs/execution/src/infrastructure/queue/execution-queue.module.ts`,
	`monolith-backend/libs/execution/src/infrastructure/queue/execution.processor.ts`,
	`monolith-backend/libs/execution/src/domain/repositories/execution.repository.ts`,
	`monolith-backend/libs/execution/src/infrastructure/persistence/prisma-execution.repository.ts`.
- **Dependencies:** 2.1.
- **Expected outcome:** Known Redis errors and process interruption do not leave
	accepted executions indefinitely queued, and jobs are not replayed after a
	worker has claimed them.
- **Acceptance criteria:** Enqueue errors mark QUEUED as FAILED; a stale queued
	row is re-enqueued with its original execution ID; duplicate job delivery
	does not invoke nodes twice; failed jobs mark unfinished records FAILED.
- **Priority:** P0.

### 2.3 Persist truthful node progress

- **Description:** Make a running node visible before its executor completes,
	then update that same per-execution/node log to SUCCESS or FAILED. Preserve
	SKIPPED logs for inactive branches. If progress is deferred, explicitly ship
	only overall RUNNING plus completed node results and do not infer an active
	node in the UI.
- **Relevant files:**
	`monolith-backend/libs/execution/src/application/services/node-runner.ts`,
	`monolith-backend/libs/execution/src/application/services/workflow-engine.ts`,
	`monolith-backend/libs/execution/src/domain/repositories/execution.repository.ts`,
	`monolith-backend/libs/execution/src/infrastructure/persistence/prisma-execution.repository.ts`,
	`monolith-backend/prisma/schema.prisma`.
- **Dependencies:** 2.1.
- **Expected outcome:** Polling can show actual node-level RUNNING state without
	guessing from graph order.
- **Acceptance criteria:** A delayed executor exposes a RUNNING log to a read;
	completion updates that log; node failure records its error; inactive branch
	logs remain SKIPPED; persistence failures do not silently report success.
- **Priority:** P1.

## Phase 3: API Changes

### 3.1 Change start response and add owner-scoped reads

- **Description:** Change `POST /api/executions` to HTTP 202 and return the
	execution resource. Accept/validate `Idempotency-Key`. Add GET by execution ID
	and a paginated workflow/version history endpoint. Enforce ownership in
	application/repository queries and retain the standard response envelope.
- **Relevant files:**
	`monolith-backend/libs/execution/src/presentation/http/execution.controller.ts`,
	`monolith-backend/libs/execution/src/presentation/http/dtos/start-execution.dto.ts`,
	`monolith-backend/libs/execution/src/application/`,
	`monolith-backend/libs/execution/src/domain/repositories/execution.repository.ts`,
	`monolith-backend/libs/execution/src/infrastructure/persistence/prisma-execution.repository.ts`,
	`monolith-backend/libs/execution/src/execution.module.ts`.
- **Dependencies:** Phase 2.
- **Expected outcome:** Clients can accept, restore, monitor, and browse
	executions without observing BullMQ.
- **Acceptance criteria:** POST responds before worker completion with 202 and
	QUEUED; GET shows evolving status/logs; list is stable paginated and newest
	first; all routes require JWT and hide non-owned executions; same-key replay
	does not create another row.
- **Priority:** P0.

## Phase 4: Frontend API Integration

### 4.1 Add start, detail, and history query contracts

- **Description:** Update execution types and API/service functions for the
	accepted resource, GET detail, and history. Add React Query hooks with a
	stable query key, bounded polling while active, and cache invalidation after
	start or terminal state.
- **Relevant files:**
	`frontend/src/features/workflow/types/execution.types.ts`,
	`frontend/src/features/workflow/api/execution.api.ts`,
	`frontend/src/features/workflow/services/execution.service.ts`,
	`frontend/src/features/workflow/hooks/useStartExecution.ts`,
	new execution query hooks under `frontend/src/features/workflow/hooks/`.
- **Dependencies:** 3.1.
- **Expected outcome:** UI data is server-backed and survives reload.
- **Acceptance criteria:** API parsing covers queued and terminal responses;
	queries poll only active executions; terminal state stops polling; failures
	surface through the existing feature error pattern.
- **Priority:** P0.

## Phase 5: Frontend UI/UX Implementation

### 5.1 Add execution selection and history to the version Run page

- **Description:** Replace local-only `executionResult` as the source of truth
	with selected execution ID and query data. Add a compact history selector for
	executions of the viewed workflow/version and preserve selection in the URL.
- **Relevant files:**
	`frontend/src/features/workflow/pages/VersionDetailPage.tsx`,
	new focused components under `frontend/src/features/workflow/components/`,
	execution query hooks from Phase 4.
- **Dependencies:** 4.1.
- **Expected outcome:** Multiple runs can be inspected and restored after a
	browser refresh without changing the existing designer or unrelated pages.
- **Acceptance criteria:** Selecting history changes selected run/canvas/logs;
	query-string ID restores after refresh; a missing/unauthorized ID displays a
	recoverable not-found state; a new Run gets a fresh idempotency key.
- **Priority:** P0.

### 5.2 Adapt Run and execution visual states

- **Description:** Separate POST submission state from execution state. Show
	QUEUED/RUNNING/terminal status, queue wait/start/finish timing, duration, ID,
	partial logs, outputs, and errors. Map server log states to canvas nodes.
- **Relevant files:**
	`frontend/src/features/workflow/pages/VersionDetailPage.tsx`,
	runner node component in the same page or its extracted component,
	`frontend/src/features/workflow/types/execution.types.ts`.
- **Dependencies:** 4.1 and 2.3 for a live-node RUNNING indicator.
- **Expected outcome:** Run returns to its available state after acceptance;
	background progress is visible and does not masquerade as request loading.
- **Acceptance criteria:** QUEUED has pending nodes and visible waiting status;
	RUNNING shows only server-confirmed node states; SUCCESS/FAILED stop polling;
	node details always belong to the selected execution; no cancellation control
	is rendered.
- **Priority:** P0 for overall and completed-node states; P1 for live active-node
	status if 2.3 is deferred.

## Phase 6: Testing and Validation

### 6.1 Update backend tests and add migration/API coverage

- **Description:** Add unit, integration, and e2e coverage for shared start,
	worker state, idempotency, queue errors/recovery, owner-scoped reads, and
	asynchronous API response. Update tests that currently assert a completed
	result directly from `POST /api/executions`.
- **Relevant files:**
	`monolith-backend/test/unit/execution/application/start-execution.handler.spec.ts`,
	`monolith-backend/test/unit/execution/application/webhook-execution.spec.ts`,
	`monolith-backend/test/support/execution/start-execution.test-support.ts`,
	`monolith-backend/test/e2e/execution/execution-item-model.e2e-spec.ts`,
	new focused execution API/integration specs under `monolith-backend/test/`.
- **Dependencies:** Phases 1 to 3.
- **Expected outcome:** Existing execution semantics remain covered while the
	HTTP contract becomes asynchronous.
- **Acceptance criteria:** Tests cover successful manual queue/worker run,
	queue failure, worker failure, duplicate request/job, all status transitions,
	version snapshot, auth, invalid version, and status/result polling.
- **Priority:** P0.

### 6.2 Add frontend behavior tests and run project gates

- **Description:** Test accepted start, polling, node mapping, run selection,
	history, refresh restoration, and error states. Run backend and frontend
	targeted suites, type checks, and builds.
- **Relevant files:**
	`frontend/src/features/workflow/` tests colocated with APIs/hooks/components;
	`frontend/package.json`; `monolith-backend/package.json`.
- **Dependencies:** Phases 4 and 5.
- **Expected outcome:** Frontend state behavior is verified independently of
	React Flow styling and with API boundaries mocked.
- **Acceptance criteria:** Tests assert user-visible behavior and query
	accessibility roles; backend `npm test` and frontend `npm test` plus project
	type/build gates pass; no test assumes `POST` returns completed node logs.
- **Priority:** P0.

## Deferred Improvements

- Transactional outbox if queued-row reconciliation is insufficient for the
	required delivery guarantee.
- SSE if measured polling traffic or latency warrants server push.
- Cooperative cancellation, per-node timeout/cancel semantics, and safe handling
	of in-flight external side effects.
- Execution retention, archival, and paginated node-log detail for large runs.
- Worker leases/heartbeats if legitimate runs can exceed the current stale age
	threshold.
