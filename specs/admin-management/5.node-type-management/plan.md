# Kế hoạch triển khai: Quản lý Loại Node

Status: implemented. Validation results and limitations are recorded in task.md.

## Approved scope

Implement the G5 contracts clarified in spec.md: existing categories, distinct current workflow usage, independent palette/runtime policy, existing-workflow metadata compatibility, optimistic revisions and atomic audit. User approved the repository analysis and authorized implementation on 2026-11-22.

## Vertical slices

1. Preserve the platform-owned disabled runtime error code: Red allowlist test, Green extension.
2. Implement policy planning with Red behavior/validation tests, then the dedicated schema, public port, CQRS handler, transaction/audit adapter and presentation mapping.
3. Extend the runner without breaking existing creation signatures: Red engine test proves executor still runs; Green policy gate and typed failed logging.
4. Add Admin read/mutation HTTP: Red endpoint404, then typed filters/projections, DTOs, multi-field whitelist and endpoints.
5. Add metadata HTTP: Red endpoint404, then bounded authenticated metadata retrieval and palette filtering.
6. Preserve Designer editing: Red hidden node appears in Sidebar; Green metadata hydration/filtering and configuration preservation. Existing Publish tests exposed an initial hydration race; hydrate from draft before the first canvas render.
7. Build Admin UI: Red missing dialog/page controls; Green dialog validation/mutation, URL filters, usage/details and route/menu.
8. Verify with isolated PostgreSQL (migration, real JWT, distinct counts, optimistic concurrency, no-op, audit rollback, catalog sync and real runtime persistence), relevant/full unit suites, lint, type checking and builds.

## Operational rollout

After reviewing the code, apply the checked-in migration using the normal deployment workflow before starting the updated backend. No existing workflow definitions, catalog metadata or policies require a data rewrite. Node policies default to visible/allowed until an Admin changes them.

Runtime disable applies before the next node starts; it does not cancel an API call already in progress. Client palette visibility refreshes on focus/foreground polling and after mutations within the same query client.
