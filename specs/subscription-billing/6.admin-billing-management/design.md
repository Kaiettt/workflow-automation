# Design: Admin Billing Management

## Boundaries

Billing administration belongs to the existing `libs/admin` module. Its controller remains under `/api/admin`, with the module-level JWT, role, validation, and raw mutation-field guards. Application query/command contracts stay in the admin module; Prisma access and audit writes stay in its infrastructure.

## API

- `GET /api/admin/billing/plans`: all plans, including inactive, ordered by plan code.
- `PATCH /api/admin/billing/plans/:id`: update only `priceVnd`, `monthlyQuota`, and `isActive`; body also requires `expectedRevision` and `reason`.
- `GET /api/admin/billing/subscriptions`: paginated filters `q` (email), `status`, and `planId`.
- `GET /api/admin/billing/payments`: paginated filters `status`, `from`, and `to`.
- `GET /api/admin/billing/revenue`: completed payment totals by the plan recorded on the order for required ISO date bounds `from` and `to`.

Paged read responses use `{ items, total, page, pageSize }`. Date filters are timezone-qualified ISO timestamps and use a half-open interval `[from, to)`. Validation bounds page sizes and date range duration. Responses select only the fields defined in the spec.

## Plan mutation and consistency

`SubscriptionPlan.revision` is incremented only for actual changes. A transaction checks the expected revision, updates the catalog, and writes `AdminAuditEvent` before/after snapshots using action `SUBSCRIPTION_PLAN_CHANGED` and target type `SUBSCRIPTION_PLAN`. A stale revision returns a conflict. Plan edits do not rewrite `PaymentOrder.amountVnd`, subscription periods, or existing `SubscriptionUsage.totalQuota`; usage creation continues to snapshot the current plan quota for new periods.

## Frontend

The admin feature owns `features/admin/billing/` API hooks, types, page, and components. The page is nested in the existing AdminGuard/AdminLayout route and adds Billing navigation. TanStack Query owns server state and narrowly invalidates the plan list after changes. The plan dialog captures reason and revision; list views expose pagination and filters; revenue has an explicit date range.

## Test seams

- Unit tests for controller dispatch and DTO validation/role metadata.
- Port/repository tests for atomic revision checking, audit snapshots, no-op updates, filtered pagination, restricted projections, and completed-only revenue.
- Frontend component tests for plan update, filters/pagination, revenue rendering, loading/error/empty states; verify the route is nested under AdminGuard.
- Run focused tests, lint, backend type-check/build and frontend type-check/build.
