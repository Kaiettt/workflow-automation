# Ticket 6: Admin Billing Management

## Purpose

Give platform administrators a protected view for managing subscription plans and monitoring subscriptions, payment orders, and successful-payment revenue.

## Requirements and acceptance criteria

- **AC-6.1 Plan catalog:** An administrator can list all plans, including inactive plans, and update price, monthly quota, and active state.
- **AC-6.2 Safe plan changes:** An update requires a 5–500 character reason and the current revision. Stale revisions are rejected. Successful changes increment the revision and create an audit event with before/after values. A no-op does not create an audit event or increment the revision.
- **AC-6.3 Existing billing records:** Plan edits affect future checkout prices. Existing payment order amounts and subscription periods remain unchanged. The current usage quota remains the persisted usage quota; newly created usage periods use the updated plan quota.
- **AC-6.4 Subscription monitoring:** An administrator can search by user email, filter by subscription status and plan, and page through results. Results include user email, plan, period, status, and current usage quota/consumption, without workflow payloads or credentials.
- **AC-6.5 Payment monitoring:** An administrator can page through payment orders and filter by status and date range. Results include order code, transaction number, bank code, user email, plan, amount, status, and payment/order timestamps. Provider response payloads are excluded.
- **AC-6.6 Revenue summary:** An administrator can select a date range and see completed payment totals grouped by the plan on each payment order. Failed and pending orders do not contribute.
- **AC-6.7 Authorization:** Every admin billing endpoint is protected by the existing JWT and ADMIN role guards. A CLIENT cannot read or mutate billing administration data.
- **AC-6.8 Admin UI:** The protected Admin Portal provides Billing navigation and tabs/views for plans, subscriptions, payment orders, and revenue. Loading, empty, error, and mutation feedback are presented accessibly.

## BDD scenarios

### [SCENARIO-SUB-12] Admin updates a plan

**Given** an authenticated administrator viewing the plan catalog  
**When** they update a plan's price, quota, or active state with a valid reason and current revision  
**Then** the new catalog values are saved, the revision increases, and an audit event records the change  
**And** future orders use the new price while existing orders and subscription periods retain their recorded values.

### [SCENARIO-SUB-12-STALE] A stale plan edit is rejected

**Given** another administrator has already updated a plan  
**When** an administrator submits an edit with an old revision  
**Then** the server rejects the edit and leaves the plan and audit log unchanged.

### [SCENARIO-SUB-12-SEARCH] Admin searches subscriptions and payments

**Given** an administrator opens Billing in the Admin Portal  
**When** they search subscriptions by email or filter by status/plan, or filter payment orders by status/date  
**Then** the server returns stable, paginated results containing only the specified billing fields.

### [SCENARIO-SUB-12-REVENUE] Admin reviews revenue by plan

**Given** payment orders with completed, pending, and failed states in the selected date range  
**When** an administrator requests the revenue summary  
**Then** only completed order amounts are summed and grouped by their recorded plan.

### [SCENARIO-SUB-12-AUTH] Billing administration is restricted to admins

**Given** a client account  
**When** it requests an admin billing endpoint  
**Then** the request is denied and no billing administration data or mutation is returned.

## Traceability

| Acceptance criterion | Scenarios |
|---|---|
| AC-6.1, AC-6.2, AC-6.3 | SCENARIO-SUB-12, SCENARIO-SUB-12-STALE |
| AC-6.4, AC-6.5 | SCENARIO-SUB-12-SEARCH |
| AC-6.6 | SCENARIO-SUB-12-REVENUE |
| AC-6.7 | SCENARIO-SUB-12-AUTH |
| AC-6.8 | SCENARIO-SUB-12, SCENARIO-SUB-12-SEARCH, SCENARIO-SUB-12-REVENUE |
