# Workflow Execution Monitoring – Improvement Specification

## 1. Overview

### 1.1. Purpose

This specification defines the bugs, architectural limitations, and proposed improvements for the Workflow Execution Monitoring module in FlowPilot.

The primary goal is to improve execution status accuracy, real-time monitoring reliability, event delivery consistency, and overall system observability.

The proposed work is divided into two main categories:

- **Bugs:** Existing behaviors that produce incorrect results or inconsistent UI representations.
- **Improvements / Limitations:** Architectural limitations and missing capabilities that should be addressed to improve reliability, scalability, and usability.

### 1.2. Scope

This specification covers:

- Execution status representation.
- Node execution status and duration.
- Execution canvas state management.
- Real-time execution monitoring through Server-Sent Events (SSE).
- Execution event publishing and recovery.
- Queue and execution metrics.
- Execution cancellation and retry capabilities.
- Execution history management.
- Automated trigger monitoring.
- Failure notifications.
- Infrastructure and worker observability.

---

## 2. Bugs – Required Fixes

These issues represent incorrect or inconsistent behaviors in the current implementation and should be addressed before introducing additional monitoring capabilities.

### BUG-01: Fix Incorrect Node Status Rendering

**Priority:** High

**Description:**

Nodes currently in the `RUNNING` state may be displayed as `FAILED` in the Node Execution Logs table.

This behavior is likely caused by incomplete status mapping logic in the frontend.

**Expected Behavior:**

- Correctly display all supported node execution statuses.
- Ensure `RUNNING` nodes are never incorrectly displayed as `FAILED`.
- Maintain consistent status representations between the execution canvas and Node Execution Logs.

**Acceptance Criteria:**

- [ ] `RUNNING` nodes are displayed correctly.
- [ ] `SUCCESS`, `FAILED`, and other supported statuses are mapped correctly.
- [ ] Canvas and log table display consistent node statuses.

### BUG-02: Fix Node Execution Duration Display

**Priority:** Medium

**Description:**

The Duration column currently displays `startedAt` instead of `durationMs`, resulting in incorrect execution duration information.

**Expected Behavior:**

- Use `durationMs` as the source of truth for node execution duration.
- Format the duration into a human-readable representation.
- Handle missing or unavailable duration values gracefully.

**Acceptance Criteria:**

- [ ] Duration is calculated and displayed using `durationMs`.
- [ ] The displayed value represents elapsed execution time, not a timestamp.
- [ ] Null or unavailable duration values are handled correctly.

### BUG-03: Fix Live Node Status Mapping

**Priority:** High

**Description:**

The frontend needs to correctly map execution events to node statuses.

The current implementation may incorrectly default events without an explicit status to `SUCCESS`, including events that do not represent successful completion.

Relevant events include:

- `node.started`
- `node.completed`
- `node.failed`
- `node.skipped`

**Expected Behavior:**

Define explicit event-to-status mappings:

| Event | Expected Node Status |
|---|---|
| `node.started` | `RUNNING` |
| `node.completed` | `SUCCESS` |
| `node.failed` | `FAILED` |
| `node.skipped` | `SKIPPED` |

Events without a recognized mapping must not automatically be treated as successful.

**Acceptance Criteria:**

- [ ] Each supported event maps to its corresponding node status.
- [ ] Unknown events do not default to `SUCCESS`.
- [ ] Event processing does not overwrite a newer node state with an outdated state.
- [ ] Live canvas updates and Node Execution Logs remain consistent.

### BUG-04: Fix Execution Canvas State Reset

**Priority:** Medium

**Description:**

When selecting another execution or loading a new execution snapshot, the canvas must correctly reset its previous node and edge states.

Without proper state initialization, the canvas may retain execution data from a previously selected execution.

**Expected Behavior:**

- Reset node execution states when switching executions.
- Reset edge execution states when switching executions.
- Reconstruct the canvas state using the newly selected execution snapshot.
- Prevent stale execution data from appearing during execution transitions.

**Acceptance Criteria:**

- [ ] Switching executions clears previous execution states.
- [ ] Newly loaded snapshots correctly initialize node and edge states.
- [ ] Previous execution data does not leak into the currently selected execution.
- [ ] Reloading the same execution produces consistent results.

### BUG-05: Handle Unknown and Timeout Node Statuses

**Priority:** Medium

**Description:**

Node statuses such as `TIMEOUT` and unknown status values are not handled consistently.

Some statuses may be grouped into `FAILED`, while others may be displayed inconsistently between the execution canvas and Node Execution Logs.

**Expected Behavior:**

- Explicitly handle `TIMEOUT` as a distinct execution status where supported by the execution engine.
- Define a fallback representation for unknown statuses.
- Maintain consistent status handling across all monitoring components.

**Acceptance Criteria:**

- [ ] `TIMEOUT` is distinguishable from `FAILED`.
- [ ] Unknown statuses do not break the monitoring UI.
- [ ] Canvas and log table use consistent status representations.
- [ ] Existing execution statuses remain backward-compatible.

---

## 3. Architecture & Reliability – Proposed Improvements

These improvements address architectural limitations and missing capabilities that may affect execution monitoring reliability, scalability, and usability.

They are not necessarily existing functional bugs. Before implementation, the current backend APIs and execution engine capabilities should be reviewed to avoid duplicating existing functionality.

### IMP-01: Replace In-Memory Execution Event Publisher

**Priority:** High

**Description:**

The current `InMemoryExecutionEventPublisher` publishes events only within the memory space of a single backend process.

This creates limitations when FlowPilot runs multiple backend instances because events are not automatically shared between instances.

**Proposed Improvement:**

Replace the in-memory event publisher with a distributed event publishing mechanism, such as:

- Redis Pub/Sub.
- A distributed message broker.
- Another suitable event distribution mechanism.

**Expected Behavior:**

- Execution events should be accessible across backend instances.
- Multiple backend instances should be able to participate in execution monitoring.
- Event publishing should not depend on a single process's memory.

**Acceptance Criteria:**

- [ ] Execution events can be distributed across backend instances.
- [ ] SSE clients connected to different instances can receive relevant execution updates.
- [ ] Event publishing and subscription work correctly in a multi-instance environment.
- [ ] Existing event contracts remain compatible with the monitoring frontend.

### IMP-02: Prevent Execution SSE Snapshot-Subscription Race Condition

**Priority:** High

**Description:**

The current `ExecutionStreamService` retrieves the execution snapshot before subscribing to execution events.

An event occurring between these two operations may be missed entirely.

This creates a race condition that can cause the initial execution state and subsequent live updates to become inconsistent.

**Proposed Improvement:**

Implement a synchronization mechanism to ensure that no execution events are lost during SSE initialization.

Possible approaches:

- Subscribe to execution events before retrieving the snapshot.
- Introduce event versioning or sequence numbers.
- Use an event replay mechanism to recover events occurring during initialization.

**Expected Behavior:**

- The initial snapshot and subsequent events must form a consistent execution state.
- Events occurring during SSE initialization must not be silently lost.

**Acceptance Criteria:**

- [ ] SSE initialization does not introduce a snapshot-subscription event gap.
- [ ] Events occurring during initialization can be recovered or processed.
- [ ] Duplicate events are handled safely if the selected strategy can produce them.
- [ ] The final execution state remains consistent with the backend execution state.

### IMP-03: Add Execution Event Recovery Mechanism

**Priority:** High

**Description:**

The current SSE implementation does not provide a reliable event replay mechanism based on event IDs.

When a client disconnects temporarily, it may miss execution updates generated during the disconnected period.

**Proposed Improvement:**

Introduce event recovery using one or more of the following mechanisms:

- Unique execution event IDs.
- Event sequence numbers.
- SSE `Last-Event-ID` support.
- Snapshot-based state synchronization.
- Event persistence with a configurable retention period.

**Expected Behavior:**

When a client reconnects, it should be able to recover missed execution updates or retrieve a fresh, consistent execution snapshot.

**Acceptance Criteria:**

- [ ] Execution events have unique identifiers or sequence numbers.
- [ ] Reconnecting clients can request recovery of missed events where supported.
- [ ] The system supports snapshot-based recovery when event replay is unavailable.
- [ ] Node execution logs remain consistent after reconnection.
- [ ] Duplicate or out-of-order events do not corrupt the monitoring state.

### IMP-04: Add Queue Waiting Time Metrics

**Priority:** Medium

**Description:**

The current monitoring interface provides execution duration and start time but does not clearly expose how long an execution waits in the queue.

This makes it difficult to distinguish queue delays from actual workflow execution time.

**Proposed Improvement:**

Introduce a separate queue waiting time metric.

**Expected Behavior:**

Calculate queue waiting time using:

`Queue Waiting Time = Execution Started At - Execution Queued At`

Display queue waiting time separately from execution duration.

**Acceptance Criteria:**

- [ ] Queue waiting time is recorded or calculated accurately.
- [ ] Queue waiting time is displayed separately from execution duration.
- [ ] Missing timestamps are handled gracefully.
- [ ] The metric is available for relevant execution records.

### IMP-05: Add Execution Cancellation from Monitoring UI

**Priority:** Medium

**Description:**

Provide the ability to cancel an execution directly from the monitoring interface, provided that the execution engine and backend API support cancellation.

The current implementation should first be reviewed to determine whether cancellation functionality already exists partially or completely.

**Proposed Improvement:**

Add an execution cancellation action to the monitoring interface.

**Expected Behavior:**

- Users can cancel eligible running executions.
- The backend safely handles cancellation requests.
- The execution state is updated to `CANCELLED`.
- Running nodes are handled according to the execution engine's cancellation semantics.

**Acceptance Criteria:**

- [ ] The UI provides a cancellation action for eligible executions.
- [ ] Cancellation requests are validated by the backend.
- [ ] Cancelled executions are represented consistently.
- [ ] Node states are updated appropriately after cancellation.
- [ ] Repeated cancellation requests are handled safely.

### IMP-06: Add Execution Retry and Rerun Controls

**Priority:** Medium

**Description:**

Provide mechanisms to retry or rerun failed workflow executions.

Differentiate between:

- **Rerun Workflow:** Start a new execution of the entire workflow.
- **Retry Node:** Retry a failed node if supported by the execution engine.

**Proposed Improvement:**

Introduce execution retry and rerun controls in the monitoring interface.

**Expected Behavior:**

- Users can rerun failed executions.
- Users can retry individual failed nodes if the engine supports this capability.
- New executions should maintain traceability to their original execution where applicable.

**Acceptance Criteria:**

- [ ] Users can initiate a full workflow rerun.
- [ ] Node-level retry is available only when supported by the execution engine.
- [ ] New execution records are created correctly.
- [ ] Original execution history is preserved.
- [ ] Retry and rerun actions are validated and authorized.

### IMP-07: Add Execution History Filtering and Pagination

**Priority:** Medium

**Description:**

As the number of workflow executions increases, displaying execution history without proper filtering and pagination may negatively affect performance and usability.

**Proposed Improvement:**

Introduce server-side pagination and filtering for execution history.

Suggested filters:

- Execution status.
- Execution time range.
- Execution ID.
- Workflow ID or version, where applicable.

**Acceptance Criteria:**

- [ ] Execution history supports pagination.
- [ ] Users can filter executions by status.
- [ ] Users can filter executions by time range.
- [ ] Users can search using an execution ID.
- [ ] Filtering and pagination are handled efficiently by the backend.
- [ ] Existing execution detail navigation remains functional.

### IMP-08: Add Execution Monitoring for Webhook and Scheduled Triggers

**Priority:** Medium

**Description:**

Provide a centralized monitoring experience for workflow executions generated automatically by Webhook and Cron triggers.

Currently, monitoring should not depend exclusively on users opening Version Detail and manually triggering workflow execution.

**Proposed Improvement:**

Introduce a centralized execution monitoring interface that includes executions initiated by:

- Manual triggers.
- Webhook triggers.
- Scheduled/Cron triggers.

**Expected Behavior:**

All execution sources should be represented consistently in execution history.

**Acceptance Criteria:**

- [ ] Executions triggered by Webhooks appear in centralized execution history.
- [ ] Executions triggered by Cron appear in centralized execution history.
- [ ] Execution records identify their trigger source.
- [ ] Users can inspect execution details regardless of trigger source.
- [ ] Existing manual execution monitoring remains functional.

### IMP-09: Add Execution Failure Notifications

**Priority:** Medium

**Description:**

Introduce a notification mechanism to inform users when workflow executions fail or encounter timeout conditions.

**Proposed Improvement:**

Support one or more notification channels:

- In-app notifications.
- Email notifications.

**Expected Behavior:**

Users should receive notifications for relevant execution failures based on their notification preferences.

**Acceptance Criteria:**

- [ ] The system can identify failed and timed-out executions.
- [ ] Notifications are generated for eligible failure events.
- [ ] Notifications contain relevant execution information.
- [ ] Duplicate notifications are prevented where appropriate.
- [ ] Notification delivery failures do not affect workflow execution.

### IMP-10: Add Workflow Execution Metrics Dashboard

**Priority:** Low

**Description:**

Introduce a dashboard that provides aggregated workflow execution statistics.

**Proposed Metrics:**

- Total executions.
- Successful executions.
- Failed executions.
- Success rate.
- Failure rate.
- Average execution duration.
- Execution trends over time.

**Acceptance Criteria:**

- [ ] Dashboard displays aggregated execution statistics.
- [ ] Success and failure rates are calculated correctly.
- [ ] Average execution duration is calculated using valid execution records.
- [ ] Execution trends can be visualized over time.
- [ ] Metrics can be filtered by relevant time periods.

### IMP-11: Add Infrastructure and Worker Health Monitoring

**Priority:** Low

**Description:**

Introduce infrastructure-level monitoring to provide visibility into the health of the execution infrastructure.

The current monitoring experience primarily focuses on workflow executions and does not provide sufficient visibility into worker and infrastructure health.

**Proposed Metrics:**

- Queue backlog.
- Worker health and availability.
- Failed jobs.
- Redis connectivity.
- CPU utilization.
- Memory utilization.

**Acceptance Criteria:**

- [ ] Queue backlog metrics are available.
- [ ] Worker health information is exposed.
- [ ] Failed job metrics are available.
- [ ] Redis connectivity can be monitored.
- [ ] CPU and memory utilization can be observed.
- [ ] Infrastructure health information is presented separately from workflow execution status.

---

## 4. Implementation Roadmap

The proposed implementation is divided into three phases based on correctness, reliability, and observability priorities.

### Phase 1 – Correctness

**Objective:** Ensure execution monitoring displays accurate information and does not lose critical execution updates.

| ID | Task | Priority |
|---|---|---|
| BUG-01 | Fix Incorrect Node Status Rendering | High |
| BUG-02 | Fix Node Execution Duration Display | Medium |
| BUG-03 | Fix Live Node Status Mapping | High |
| BUG-04 | Fix Execution Canvas State Reset | Medium |
| BUG-05 | Handle Unknown and Timeout Node Statuses | Medium |
| IMP-02 | Prevent Execution SSE Snapshot-Subscription Race Condition | High |
| IMP-03 | Add Execution Event Recovery Mechanism | High |

### Phase 2 – Reliability & Scalability

**Objective:** Improve event distribution, execution management, and monitoring scalability.

| ID | Task | Priority |
|---|---|---|
| IMP-01 | Replace In-Memory Execution Event Publisher | High |
| IMP-04 | Add Queue Waiting Time Metrics | Medium |
| IMP-05 | Add Execution Cancellation from Monitoring UI | Medium |
| IMP-06 | Add Execution Retry and Rerun Controls | Medium |
| IMP-07 | Add Execution History Filtering and Pagination | Medium |

### Phase 3 – Observability

**Objective:** Improve visibility into automated executions, execution performance, and infrastructure health.

| ID | Task | Priority |
|---|---|---|
| IMP-08 | Add Execution Monitoring for Webhook and Scheduled Triggers | Medium |
| IMP-09 | Add Execution Failure Notifications | Medium |
| IMP-10 | Add Workflow Execution Metrics Dashboard | Low |
| IMP-11 | Add Infrastructure and Worker Health Monitoring | Low |

---

## 5. Recommended Initial Implementation Scope

To keep the initial scope manageable and focus on the most critical monitoring issues, the following seven tickets are recommended for the first implementation cycle:

| Order | ID | Title | Priority |
|---|---|---|---|
| 1 | BUG-01 | Fix Incorrect Node Status Rendering | High |
| 2 | BUG-02 | Fix Node Execution Duration Display | Medium |
| 3 | BUG-03 | Fix Live Node Status Mapping | High |
| 4 | BUG-04 | Fix Execution Canvas State Reset | Medium |
| 5 | IMP-01 | Replace In-Memory Execution Event Publisher | High |
| 6 | IMP-02 | Prevent Execution SSE Snapshot-Subscription Race Condition | High |
| 7 | IMP-03 | Add Execution Event Recovery Mechanism | High |

**Implementation Note:**

Although IMP-01 is included in the recommended initial scope, its implementation should be coordinated with IMP-02 and IMP-03.

The event distribution, snapshot synchronization, and event recovery mechanisms should be designed together to avoid introducing multiple incompatible event-handling strategies.

---

## 6. Technical Considerations

### 6.1. Execution Status Consistency

Define a centralized execution and node status mapping strategy.

All monitoring components should use consistent status definitions, including:

- Execution history.
- Execution detail.
- Node execution logs.
- Execution canvas.
- Real-time SSE updates.

Unknown statuses should be handled explicitly rather than silently converted into successful or failed states.

### 6.2. Event Delivery Reliability

The event delivery mechanism should consider:

- Event ordering.
- Duplicate event handling.
- Event persistence or replay.
- Client reconnection.
- Snapshot synchronization.
- Multi-instance event distribution.

The system should prioritize eventual consistency and reliable state recovery over assuming that every client receives every event exactly once.

### 6.3. Backward Compatibility

Changes to execution event contracts and status representations should remain compatible with existing execution records whenever possible.

Existing execution history must remain accessible after implementation.

### 6.4. Performance

Monitoring improvements should avoid introducing unnecessary overhead into workflow execution.

In particular:

- Event publishing should not significantly block execution workers.
- Execution history filtering should be handled efficiently.
- Metrics aggregation should not require loading all execution records.
- Event retention should be configurable if event persistence is introduced.

### 6.5. Testing

The implementation should include appropriate tests for:

- Node status mapping.
- Execution duration calculation.
- Canvas state transitions.
- SSE initialization and reconnection.
- Event ordering and duplicate handling.
- Multi-instance event distribution.
- Execution cancellation and retry, where implemented.
- Execution history filtering and pagination.

---

## 7. Notes and Assumptions

1. This specification is based on the identified issues and architectural observations from the current Workflow Execution Monitoring implementation.
2. Bugs represent behaviors that should be corrected.
3. Improvements represent proposed enhancements or architectural limitations and do not necessarily mean that the corresponding functionality is entirely absent.
4. IMP-05 (Execution Cancellation) and IMP-06 (Execution Retry and Rerun) require further investigation of existing backend APIs and execution engine capabilities before implementation.
5. The proposed distributed event publisher, event recovery, and SSE synchronization strategies should be reviewed together before finalizing the architecture.
6. Priorities represent suggested implementation priorities and may be adjusted based on technical feasibility and project requirements.

---

## 8. Expected Outcomes

After completing the proposed improvements, Workflow Execution Monitoring should provide:

- Accurate and consistent execution status representations.
- Reliable node-level execution information.
- Consistent execution canvas state transitions.
- Reliable real-time monitoring through SSE.
- Event recovery after temporary client disconnections.
- Support for distributed backend instances.
- Better visibility into execution queue delays and performance.
- Improved execution history management.
- Centralized monitoring for manual and automated triggers.
- Better operational visibility through notifications and infrastructure metrics.

The overall objective is to make FlowPilot's Workflow Execution Monitoring reliable enough to support increasingly complex workflows and larger-scale execution workloads.