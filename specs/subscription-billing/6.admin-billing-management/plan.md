# Implementation Plan: Admin Billing Management

## Vertical slices

1. Add plan revision migration and audited optimistic-concurrency command. Verify stale, no-op, and successful updates.
2. Add CQRS-backed admin billing read contracts for plan, subscription, payment, and revenue views with bounded filters and projections.
3. Add protected controller DTOs and endpoint tests under the existing ADMIN-only controller.
4. Add feature-owned admin billing API/hooks and plans/subscriptions/payments/revenue UI; integrate the protected route and navigation.
5. Run focused tests, lint, type checking, Prisma validation, and builds; record results in `task.md`.
