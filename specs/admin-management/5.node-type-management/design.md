# Thiết kế: Quản lý Loại Node

Status: implemented; final validation evidence is in task.md.

## Ownership and module interfaces

- Node Library owns catalog metadata and NodeTypePolicy. ChangeNodeTypeStatusCommand delegates to NodeTypePolicyPort; the Prisma adapter owns the short transaction, advisory lock 7261103 and atomic audit write.
- Domain policy planning validates reason/flags/revision, checks stale revision before no-op, merges partial updates and increments revision once. Domain/application contain no Prisma or HTTP exceptions.
- AdminController applies verified Admin identity, DTO validation and the existing raw-body guard extended to multiple flags. A presentation filter maps policy outcomes to 400/404/409.
- AdminReadPort exposes typed nodeTypes/nodeType projections. The read adapter intentionally joins catalog/policy/connector metadata and returns an explicit safe projection.
- ExecutionModule imports the Node Library public policy port. Its NodeRunner factory always supplies the port. Legacy constructor/create callers remain compatible.
- NodeTypeDefinition.isActive continues to describe package/catalog availability. Admin changes neither isActive nor executor registration.

## Database and transaction

NodeTypePolicy uses node_type_key (varchar 150) as its primary key/FK to NodeTypeDefinition.key, two boolean defaults true, nonnegative revision default 0, and updatedAt. The catalog definition has an optional policy relation.

The migration only adds node_type_policies, a revision constraint and the catalog FK. It was rehearsed in isolated PostgreSQL databases and applied to the local development database on 2026-11-22. Production deployment remains a separate operational step.

Within one transaction: lock; resolve the definition and current/default policy; validate/plan; return unchanged policy for a no-op; upsert both merged flags/revision; create NODE_TYPE_STATUS_CHANGED audit. The audit target is the definition UUID, with key/flags/revision in before/after. Failure to persist audit rolls everything back.

Catalog sync already writes only connectors and definitions; no production sync rewrite was needed. Real integration tests verify policy survives repeated sync.

## Read contracts

- List supports q/category/connectorId/visibility/execution filters, page/pageSize (20 default, 100 max), displayName/updatedAt sorting, asc/desc order and stable key tiebreaker.
- Effective updatedAt is policy.updatedAt or definition.updatedAt. Missing policies remain visible/allowed with revision0, including filtered reads.
- Parameterized JSONB containment matches nodes[].data.key. Published counts use only PUBLISHED workflows/currentVersion; draft counts use DRAFT workflows/WorkflowDraft. Counts are distinct per workflow even with repeated nodes. No workflow JSON is loaded into application memory to calculate usage.
- List/count and detail/usage reads use repeatable-read snapshots.
- Detail includes schemas and at most 10 matching workflows, updatedAt descending/id ascending, exposing only id/name/ownerEmail/status. Archives/history are excluded.

## Palette and compatibility

GET /api/node-types filters active catalog definitions by effective visibility. Existing schema-by-key queries remain unfiltered.

Authenticated GET /api/node-types/metadata accepts 1–100 unique keys of 1–150 characters and returns full metadata for those existing types, including hidden types. This is separate from palette authorization.

Designer hydrates keys from the initial draft and the live graph, including restore/template changes, in batches of 100. It merges schemas into the existing metadata store; only types authorized by the palette response are marked addable. Sidebar filters that marker; Canvas/BaseNode/PropertiesPanel retain hidden metadata, named outputs and editing behavior. Query failures have retry UI and prevent unsafe autosave while metadata is unavailable.

Client catalog/metadata queries refresh on focus and every 30 seconds while the tab is active; Admin mutations invalidate these queries within their current query client.

## Runtime

NodeRunner checks isExecutionAllowed before executor/config/credential work, within its error-handling path. Disabled policy raises the domain NodeTypeDisabledError; NodeExecutionObserver records FAILED/NODE_TYPE_DISABLED through the existing safe persistence path. WorkflowEngine already stops on FAILED.

Policy lookup failures never invoke the executor. Each node is checked when it starts; already executing calls/retries are not cancelled. Global safe error-code filtering explicitly allows NODE_TYPE_DISABLED.

## Frontend

/admin/node-types is protected by the existing AdminGuard and included in AdminLayout. The page uses URL filters, server pagination/sorting, connector search, loading/error/empty states, usage columns and bounded details. A shared NodeIcon reuses the existing renderer; its old import remains a compatibility export.

A keyed status dialog owns its simple three-field form. It validates a trimmed 5–500-character reason and changed flags, prevents duplicate/pending submission, and explains runtime impact. On 409 it preserves the reason, disables stale submission, reloads the current policy and requires the Admin to reselect intended changes before retrying.

The query hook owns transport lifecycle and list/detail/catalog invalidation. Native labeled selects and existing shadcn components provide accessible controls.

## Tests

Public seams: Admin/catalog HTTP with real JWT and PostgreSQL; policy decisions; NodeRunner/WorkflowEngine results and logs; Designer configuration/metadata and Admin page/dialog interactions. BDD IDs and Red/Green evidence are recorded in spec.md/task.md.
