# MVP Workflow Execution: Google Sheets → Filter → Gmail

## Status

Consolidated specification from the MVP seed, execution, demo, sample-data, and workflow-publishing notes. This document is the feature-level source of truth for implementing the end-to-end MVP.

## Problem

The workflow designer can represent a workflow, but an end-to-end MVP needs a supported catalog, a publish operation that creates an immutable version, and an execution engine that runs that version. The demo workflow reads customer rows from Google Sheets, keeps rows whose status is `new`, and sends each matching customer a templated email through Gmail.

## Goals

- Provide a dedicated, repeatable local seed for the MVP node catalog and Google connector.
- Allow a valid draft to be published as an immutable, numbered workflow version.
- Start a manual execution against a published version and persist an execution record and per-node logs.
- Execute the four-node path: manual trigger → Google Sheets read rows → filter → Gmail send.
- Keep OAuth secrets encrypted at rest and out of execution logs and API responses.

## Out of scope

- Schedule, webhook, or other non-manual triggers.
- Conditional branching and parallel graph execution.
- OAuth connect/disconnect flows and production credential provisioning. The MVP assumes a user has a usable Google credential available.
- General-purpose schema parsing/modeling for node config, input, and output schemas.
- Production automation for running the local MVP seed.

## Domain and data

### Catalog seed

Add `monolith-backend/prisma/seed-mvp.ts` and a package script such as `npm run seed:mvp`. Source node and connector payloads from `sample-data.md`. Use Prisma upserts keyed by stable IDs so repeated runs are safe. Seed the owner user before dependent records, then the Google connector, then node type definitions. Do not change the main system seed to host this MVP-specific catalog.

Seed one active `google` OAuth2 connector and these four active node type definitions:

| Key | Category | Connector | Purpose |
| --- | --- | --- | --- |
| `trigger.manual` | `TRIGGER` | none | Starts a user-requested run |
| `integration.google_sheet.readRows` | `INTEGRATION` | `google` | Reads rows from one spreadsheet tab |
| `logic.filter` | `LOGIC` | none | Filters an array by a configured condition |
| `integration.gmail.send` | `INTEGRATION` | `google` | Sends a templated email for each input item |

The catalog schemas in `sample-data.md` define the MVP fields. Sheet config requires `credential_id`, `spreadsheet_id`, and `sheet_name`. Filter config requires `field`, `operator`, and `value`; supported operators are `equals`, `not_equals`, and `contains`. Gmail config requires `credential_id`, `to`, `subject`, and `body`. Credential config fields identify the `google` connector. Expressions are supported for filter field/value and Gmail template fields as indicated in the sample schemas.

The Google Sheets and Gmail nodes use the same Google OAuth connector and may reference the same credential. A credential record stores an AES-256-GCM encrypted secret, never a plaintext token. The execution engine resolves the configured `credential_id`, verifies it belongs to the workflow owner and the expected connector, decrypts it only in memory, and passes usable credentials to the integration handler.

### Workflow graph

The workflow definition is JSON with `nodes`, `edges`, and `viewport`. Each node has `id`, `type`, `position`, and `data` containing a display `name` and `config`. Edges identify `source` and `target` node IDs. Node instances refer to catalog definitions by `type` key; they do not have a relational foreign key to individual node type rows.

The demo graph contains these connected nodes in order:

1. `trigger.manual` (`Start`), with empty config.
2. `integration.google_sheet.readRows` (`Read Customers`), with the Google credential, spreadsheet ID, and `Customers` tab.
3. `logic.filter` (`Only New Customers`), configured as `status equals "new"`.
4. `integration.gmail.send` (`Send Welcome Email`), with `to: {{email}}`, subject `Welcome, {{name}}!`, and a body greeting the customer by name.

The demo documentation's picture starts at Google Sheets, but an executable workflow includes the manual trigger as its graph entry point. The edge chain is manual → sheet → filter → Gmail.

### Draft and published version

`workflow_drafts` stores the editable definition. `workflow_versions` stores a snapshot copied from the draft at publish time. Published definitions are immutable. Publishing assigns the next sequential `version_number` for the workflow, records publisher and publication time, updates the workflow's current version, and makes its status published according to the existing schema.

The sample data illustrates one owner, one workflow, one draft, and one published version. Fixed UUIDs shown in `sample-data.md` are illustrative; seed records must use stable IDs where upserts depend on them. A real OAuth secret must not be included in checked-in seed data. Any local credential fixture must be provided through the project's existing secure configuration mechanism.

## Publish workflow

Expose `POST /workflows/:id/versions` in the workflows HTTP controller and map it to `PublishWorkflowCommand`. The handler loads the caller-owned workflow and its draft, validates it, then creates the next immutable version and updates the workflow's current-version reference atomically.

Publishing is rejected with HTTP 400 when validation fails. Validation must require:

- Exactly one trigger node.
- At least one action node.
- No disconnected nodes: every node must be connected into the trigger-rooted workflow graph.
- Node types referenced by the definition must exist and be active.

Validation errors are returned in the API's established error envelope with enough information to identify the invalid node or graph condition. The precise envelope and error-code vocabulary should follow existing controller conventions. Publishing must not create a version on validation failure.

Saving a draft clears its stored `validationErrors` to `null`, because the previous validation result no longer describes the newly saved definition.

Concurrent publish requests must not create duplicate version numbers. Version creation and current-version update must be protected by a database transaction and the schema's appropriate uniqueness constraint or equivalent concurrency control.

## Execution API and engine

Manual runs start only from **`POST /api/executions`** with `workflow_version_id`. The caller must be authorized to run that version’s workflow. The request is synchronous and returns the persisted execution after traversal finishes. Designer-published graphs and handler schemas are specified in `.scratch/mvp-execution/4-execution/contracts.md`.

Before traversal, load `workflow_versions.definition` and require a node with `data.key === "trigger.manual"`. Dispatch handlers on **`data.key`**, not React Flow `type`. Walk the unique linear path trigger → sheet → filter → Gmail (treat edges as undirected so reversed designer handles still run in that order). Branching is not supported.

The product UI lists published versions, opens one version, and has a **Run** button that calls the executions endpoint (ticket 4.4).

Create an `executions` record containing workflow and version IDs, `trigger_type: MANUAL`, triggering user, status, start/finish times, duration, and optional context. Create one `execution_node_logs` record for each node execution with node ID/key, status, actual input/output, error fields, retry count, timestamps, and duration. The four-node demo has one log for each node. Gmail processes each filtered item inside its one node invocation; the node log records the aggregate result, including sent/success/failed counts, rather than requiring one log row per email.

The manual trigger produces the initial execution context. The sheet handler reads rows from the configured spreadsheet/tab and outputs an array of JSON objects. The filter handler applies the configured condition to the incoming array and outputs only matching items. The Gmail handler renders `{{variable}}` placeholders from each item in `to`, `subject`, and `body`, then sends one email per item and returns aggregate delivery counts.

Persist `SUCCESS` for successful node and execution results. Integration or handler errors produce `FAILED` status and an error message in the node log, and the execution finishes as failed. Do not write plaintext OAuth credentials or encrypted credential payloads into node logs, execution context, or API responses. Do not include secrets in error messages or stacks.

## Example behavior

Given the sheet rows below:

```json
[
  { "name": "Kiet", "email": "kiet@gmail.com", "status": "new" },
  { "name": "An", "email": "an@gmail.com", "status": "contacted" },
  { "name": "Minh", "email": "minh@gmail.com", "status": "new" }
]
```

The filter outputs Kiet and Minh. Gmail sends two messages with subjects `Welcome, Kiet!` and `Welcome, Minh!`; the body is rendered for each recipient. The successful Gmail node output is equivalent to `{ "sent_count": 2, "success_count": 2, "failed_count": 0 }`.

## Acceptance criteria

1. Running the dedicated seed command twice completes without duplicate-record errors and leaves the four required node definitions and one Google connector available.
2. A valid manual → Google Sheets → Filter → Gmail draft can be published; the created version snapshots the definition, receives the next version number, and becomes the workflow's current version.
3. Invalid publish attempts return HTTP 400 and do not create a version. Cases include zero/multiple triggers, no action, and disconnected nodes.
4. Saving a changed draft clears stale validation errors.
5. Starting an execution against a published version records the parent execution and ordered node logs, and runs handlers with prior-node output as the next node's input.
6. The filter supports `equals`, `not_equals`, and `contains` for the configured field and value.
7. Gmail template interpolation produces one message per filtered item and reports aggregate success/failure counts.
8. Google API failures result in failed node/execution status with diagnosable error data, without leaking credentials.
9. A version's definition remains unchanged if its source draft is later edited or saved.
10. A versions list and a version detail page load published versions for a workflow; Run on the detail page starts `POST /api/executions` for that version and surfaces the returned status.

## Verification

- Unit coverage: publish validation and version numbering behavior; graph traversal; filter operators; Google Sheets and Gmail handlers with mocked Google API clients; template interpolation; secret redaction.
- Integration coverage: publishing through `POST /workflows/:id/versions`, including HTTP 400 validation behavior; execution endpoint persistence of execution and node logs.
- Manual local verification: run `npm run seed:mvp` and inspect the seeded catalog in the database.

## Source notes and unresolved contract details

This specification consolidates `.scratch/mvp-execution/1-seed-data/1-seed-mvp-data.md`, `.scratch/publish-workflow-version/issues/02-implement-publish-workflow-command.md`, `.scratch/publish-workflow-version/issues/03-expose-publish-api.md`, `.scratch/mvp-execution/4-execution/contracts.md`, `.scratch/mvp-execution/4-execution/4.1-execution-engine-foundation.md`, `.scratch/mvp-execution/4-execution/4.2-execution-node-handlers-core.md`, `.scratch/mvp-execution/4-execution/4.3-execution-integrations.md`, `.scratch/mvp-execution/4-execution/4.4-execution-run-ui.md`, `.scratch/mvp-execution/mvp-example.md`, and `.scratch/mvp-execution/sample-data.md`.

The source notes do not specify exact HTTP response DTOs, the existing workflow status enum values, or the spreadsheet's real local fixture/credential provisioning path. Implement these using repository schema and API conventions; do not commit live credential material. The initial execution-engine note describes placeholder node outputs, while later handler notes require actual outputs; this consolidated end-to-end spec takes the actual handler behavior as the MVP target. The sample-data prose also says “2 connectors” and “2 credentials” while its concrete payload defines one unified Google connector and one credential; this spec follows the concrete model of one connector and a shared credential.
