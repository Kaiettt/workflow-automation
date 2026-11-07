# Asynchronous Manual Execution Tasks

This checklist is the execution-ready work breakdown. Acceptance criteria are
gates for completing each task. Priority definitions and architectural decisions
are in `plan.md` and `design.md`.

## Phase 1: Backend Refactoring and Shared Pipeline

### [ ] 1. Create shared queued-execution starter

- **Description:** Centralize execution row creation, job creation, and known
	enqueue-failure handling. Accept a resolved version and explicit trigger
	type, actor, and trigger items.
- **Files/modules:** `monolith-backend/libs/execution/src/application/services/`,
	`application/ports/execution-queue.port.ts`, `execution.module.ts`, execution
	repository interface.
- **Dependencies:** None.
- **Expected outcome:** One application boundary owns common queue-start
	lifecycle for both triggers.
- **Acceptance criteria:** MANUAL and WEBHOOK inputs create QUEUED records and
	the same job envelope; enqueue failure marks only a QUEUED/RUNNING record
	FAILED; neither caller invokes the engine's run method.
- **Priority:** P0.

### [ ] 2. Route manual and webhook handlers through the starter

- **Description:** Preserve manual ownership and graph preflight; pass
	`MANUAL`, actor ID, and empty items. Preserve webhook event filtering and
	payload creation; pass `WEBHOOK`, null actor, and its parsed items.
- **Files/modules:** `application/commands/start-execution/`,
	`application/commands/enqueue-execution/`,
	`libs/triggers/src/application/commands/receive-webhook.command.ts`,
	`application/services/workflow-engine.ts`.
- **Dependencies:** Task 1.
- **Expected outcome:** Triggers remain separate and share queue lifecycle.
- **Acceptance criteria:** Manual handler returns before node work; manual
	owner/graph checks remain; webhook payload/context and response behavior
	remain compatible; a published version ID is used by the worker.
- **Priority:** P0.

## Phase 2: Queue Integration and Execution Lifecycle

### [ ] 3. Migrate execution timestamps and request idempotency

- **Description:** Add queued timestamp and persisted idempotency key, make
	worker start time nullable until claim, backfill historical queued time, and
	index execution history. Add a scoped unique constraint for actor and key.
- **Files/modules:** `monolith-backend/prisma/schema.prisma`, new Prisma
	migration, execution domain types/constants, Prisma execution repository.
- **Dependencies:** Task 1.
- **Expected outcome:** Queue wait, run duration, and request retries have
	explicit and durable semantics.
- **Acceptance criteria:** Existing rows remain readable; new QUEUED rows have
	queuedAt and no startedAt; worker claim sets startedAt; same key/same request
	resolves to one execution; same key/different request is rejected.
- **Priority:** P0.

### [ ] 4. Recover stranded queue work and retain no-replay policy

- **Description:** Add bounded recovery for old QUEUED rows by re-enqueuing the
	same execution job ID. Retain one queue attempt, atomic claim, failed-job
	handling, and safe stale RUNNING recovery. Evaluate the stale cutoff against
	legitimate long-running jobs.
- **Files/modules:** `application/ports/execution-queue.port.ts`,
	`infrastructure/queue/execution-queue.module.ts`,
	`infrastructure/queue/execution.processor.ts`, execution repository and
	Prisma adapter.
- **Dependencies:** Task 3.
- **Expected outcome:** Known enqueue errors and interrupted dispatch do not
	strand executions; duplicate delivery cannot replay a claimed run.
- **Acceptance criteria:** Tests cover failed enqueue, stale queued recovery,
	duplicate job delivery, worker crash, and already-terminal executions;
	recovery does not reset or rerun SUCCESS/FAILED rows.
- **Priority:** P0.

### [ ] 5. Persist in-progress node logs

- **Description:** Persist a node as RUNNING before invoking its executor and
	update that log on completion. Keep explicit SKIPPED logs and existing
	sanitized errors. If deferred, document that the frontend shows only overall
	RUNNING and completed node logs.
- **Files/modules:** `application/services/node-runner.ts`,
	`application/services/workflow-engine.ts`, execution repository interface
	and Prisma adapter, `ExecutionNodeLog` schema if a uniqueness/index change is
	required.
- **Dependencies:** Task 3.
- **Expected outcome:** Node canvas can show actual active work from persisted
	state, not inferred graph order.
- **Acceptance criteria:** During a delayed executor, GET observes RUNNING for
	that node; completion updates the same node log to SUCCESS/FAILED; skipped
	branches stay SKIPPED; persistence errors do not result in false success.
- **Priority:** P1.

## Phase 3: API Changes

### [ ] 6. Return accepted execution resource from start API

- **Description:** Change `POST /api/executions` to 202; validate and forward
	`Idempotency-Key`; return ID, trigger, workflow/version, status, queuedAt,
	nullable startedAt, and status URL.
- **Files/modules:** `presentation/http/execution.controller.ts`,
	`presentation/http/dtos/start-execution.dto.ts`, start command/handler,
	execution response DTOs and module wiring.
- **Dependencies:** Tasks 1 to 3.
- **Expected outcome:** Start is an acceptance operation rather than a blocking
	workflow result operation.
- **Acceptance criteria:** Valid owner request returns 202 and QUEUED before
	worker completion; invalid body is 400; absent version is 404; foreign version
	follows current authorization policy; duplicate key behavior is stable.
- **Priority:** P0.

### [ ] 7. Add authorized execution detail and history reads

- **Description:** Add GET-by-ID with status and logs and paginated
	workflow/version history summaries. Enforce owner authorization in the
	application/repository path.
- **Files/modules:** `execution.controller.ts`, execution query/handler files,
	execution repository interface, Prisma execution repository, execution
	module.
- **Dependencies:** Task 3.
- **Expected outcome:** UI can poll, restore, and switch between execution
	sessions without direct database or queue access.
- **Acceptance criteria:** GET reflects state/log updates; history is newest
	first with bounded stable pagination; unauthorized executions do not leak;
	JWT remains required; response envelope follows existing API conventions.
- **Priority:** P0.

## Phase 4: Frontend API Integration

### [ ] 8. Implement execution API types, services, and queries

- **Description:** Model accepted/start/detail/history contracts and add React
	Query hooks. Poll active executions at a bounded interval and stop polling at
	terminal status.
- **Files/modules:** `frontend/src/features/workflow/types/execution.types.ts`,
	`api/execution.api.ts`, `services/execution.service.ts`,
	`hooks/useStartExecution.ts`, new hooks in `features/workflow/hooks/`.
- **Dependencies:** Tasks 6 and 7.
- **Expected outcome:** Execution state comes from server queries and survives
	component lifecycle changes.
- **Acceptance criteria:** 202 response is treated as accepted, not completed;
	status queries poll only QUEUED/RUNNING; errors are surfaced; generated
	idempotency key is reused for retry of the same submission only.
- **Priority:** P0.

## Phase 5: Frontend UI/UX Implementation

### [ ] 9. Implement selected execution, history, and refresh restoration

- **Description:** Replace local-only result state in the published version Run
	page with selected execution ID and query data. Add a focused run-history
	selector and preserve selection in the URL.
- **Files/modules:** `frontend/src/features/workflow/pages/VersionDetailPage.tsx`,
	focused components under `features/workflow/components/`, execution hooks.
- **Dependencies:** Task 8.
- **Expected outcome:** Users can inspect several runs and return to an active
	run after refresh.
- **Acceptance criteria:** Selecting history changes result/canvas/logs;
	refresh restores URL-selected execution; new intentional Run gets a fresh
	idempotency key; unknown execution has a recoverable error state.
- **Priority:** P0.

### [ ] 10. Separate submission loading from execution progress

- **Description:** Make the Run button pending only during POST submission.
	Render QUEUED/RUNNING/terminal status, queued/start/finish time, duration,
	execution ID, partial logs, outputs, and errors. Map persisted node states to
	canvas visuals.
- **Files/modules:** `VersionDetailPage.tsx`, runner node component, execution
	types, status/log components as needed.
- **Dependencies:** Task 8; Task 5 for live active-node status.
- **Expected outcome:** UI explains acceptance and ongoing work without waiting
	for request completion or fabricating a currently running node.
- **Acceptance criteria:** Queue state shows pending nodes; running state shows
	server-confirmed logs; terminal state stops polling; selected execution owns
	all displayed logs; no cancel button appears.
- **Priority:** P0 for overall and completed-node states; P1 for live node state
	if Task 5 is deferred.

## Phase 6: Testing and Validation

### [ ] 11. Test backend lifecycle, API, and migration

- **Description:** Update synchronous manual tests and add unit/integration/e2e
	coverage for queue acceptance, worker execution, failures, duplicate
	submissions, authorization, reads, and snapshot behavior.
- **Files/modules:** `monolith-backend/test/unit/execution/application/`,
	`test/support/execution/start-execution.test-support.ts`,
	`test/e2e/execution/execution-item-model.e2e-spec.ts`, new API/integration
	specs, Prisma migration tests where available.
- **Dependencies:** Tasks 1 to 7.
- **Expected outcome:** Contract and lifecycle regressions are caught at their
	owning boundaries.
- **Acceptance criteria:** Cover accepted response before completion, eventual
	success, queue failure, worker failure, QUEUED/RUNNING/terminal transitions,
	duplicate HTTP/job delivery, version pinning, and owner authorization.
- **Priority:** P0.

### [ ] 12. Test frontend interactions and run gates

- **Description:** Add focused tests for start, polling, node mapping, run
	history, switching, refresh restoration, and error states. Run backend and
	frontend targeted suites, type checks, and builds.
- **Files/modules:** Colocated tests under `frontend/src/features/workflow/`,
	`frontend/package.json`, `monolith-backend/package.json`.
- **Dependencies:** Tasks 8 to 10.
- **Expected outcome:** User-visible lifecycle behavior and compile/test gates
	pass before release.
- **Acceptance criteria:** Tests assert accessible user behavior, not CSS
	internals; active polling ends on terminal status; refresh and multiple runs
	are covered; backend and frontend required gates pass.
- **Priority:** P0.

## Deferred Follow-up

### [ ] 13. Evaluate stronger delivery guarantees and cancellation

- **Description:** Add a transactional outbox if queued-row reconciliation does
	not satisfy operational durability requirements. Design cooperative
	cancellation only after defining worker interruption and external side-effect
	behavior.
- **Files/modules:** Execution persistence, queue adapter/processor, API and
	frontend only after an approved cancellation contract.
- **Dependencies:** Initial migration deployed and failure metrics observed.
- **Expected outcome:** Evidence-based reliability and cancellation follow-up,
	without adding unsupported controls to the first release.
- **Acceptance criteria:** Outbox has an atomic Postgres write and idempotent
	dispatcher; cancellation has race-safe queued removal, worker signaling, and
	terminal-state tests before any UI control ships.
- **Priority:** P2.
