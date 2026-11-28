# Implementation Plan: Subscription & Billing with VNPAY

## 1. Approach & Strategy

Implementation follows vertical slices driven by BDD scenarios and TDD cycles (`docs/workflow-coding.md`). Each ticket is self-contained with its own tests, database migrations, and observable contracts.

---

## 2. Tickets Breakdown & Milestones

### Milestone 1: Core Subscription Model & Registration Hook (Ticket-1)
- **Ticket ID**: `SUB-T1-FREE-TIER`
- **Scope**:
  - Add Prisma models: `SubscriptionPlan`, `Subscription`, `SubscriptionUsage`.
  - Create database migration and seed data for initial plans (`FREE`, `STARTER`, `PRO`, `BUSINESS`).
  - Create `libs/subscription` module in NestJS.
  - Integrate with `RegisterHandler` in `libs/auth` to automatically provision an `ACTIVE` Free tier subscription for newly registered `CLIENT` users.
- **Traceable Scenarios**: `[SCENARIO-SUB-01]`

---

### Milestone 2: Atomic Execution Quota Enforcement (Ticket-2)
- **Ticket ID**: `SUB-T2-QUOTA-ENFORCE`
- **Scope**:
  - Define `QuotaReservationPort` in `libs/execution`.
  - Implement atomic `SELECT FOR UPDATE` quota check & consumption in `libs/subscription`.
  - Intercept execution requests in `ExecutionStarter`:
    - On `MANUAL` trigger: check & reserve quota. If empty, throw `QuotaExceededException` (HTTP 429).
    - On `WEBHOOK` trigger: check & reserve quota before enqueuing. If empty, reject webhook with HTTP 429.
  - Increment trigger-specific usage metrics (`manualUsage`, `webhookUsage`, `scheduleUsage`).
- **Traceable Scenarios**: `[SCENARIO-SUB-02]`, `[SCENARIO-SUB-03]`, `[SCENARIO-SUB-04]`

---

### Milestone 3: VNPay Payment Gateway & Idempotent IPN Webhook (Ticket-3)
- **Ticket ID**: `SUB-T3-VNPAY-GATEWAY`
- **Scope**:
  - Add `PaymentOrder` model to Prisma schema.
  - Create `libs/payment` module in NestJS.
  - Implement VNPay service: HMAC-SHA512 signature creation and verification.
  - Create endpoints:
    - `POST /api/v1/billing/checkout` to create a `PENDING` order and return signed VNPay URL.
    - `GET /api/v1/payments/vnpay/ipn` server-to-server webhook callback.
    - `GET /api/v1/payments/vnpay/return` redirect handler.
  - Ensure strict idempotency: duplicate IPN callbacks do not double-process orders.
- **Traceable Scenarios**: `[SCENARIO-SUB-05]`, `[SCENARIO-SUB-06]`, `[SCENARIO-SUB-07]`, `[SCENARIO-SUB-08]`

---

### Milestone 4: Subscription Lifecycle Management (Ticket-4)
- **Ticket ID**: `SUB-T4-LIFECYCLE`
- **Scope**:
  - Event listener or direct command on payment completion:
    - Immediate plan upgrade: set new plan, reset billing period (now -> +30 days), reset quota to plan limit.
  - Downgrade scheduling: save `nextPlanId` to take effect when current cycle ends.
  - Cancellation: mark `autoRenew = false`.
  - Expiration & Monthly Reset Worker:
    - BullMQ scheduled job to check expired subscriptions.
    - Transition expired paid subscriptions to `EXPIRED` status.
    - Reset monthly quota for `ACTIVE` Free subscriptions.
  - Implement `POST /api/v1/billing/subscription/switch-to-free` for expired users.
- **Traceable Scenarios**: `[SCENARIO-SUB-09]`, `[SCENARIO-SUB-10]`

---

### Milestone 5: Client Billing Dashboard UI (Ticket-5)
- **Ticket ID**: `SUB-T5-CLIENT-UI`
- **Scope**:
  - Create `frontend/src/features/billing/`:
    - Current subscription status card (Plan badge, cycle dates, auto-renew indicator).
    - Quota progress bar (used / total) and breakdown chart/table (Manual, Webhook, Schedule).
    - Pricing plans table with "Current Plan", "Upgrade", "Downgrade" buttons.
    - Payment History table (Order code, date, amount, status).
    - VNPay Payment Result page (`/billing/payment-result`) displaying success or failure from Return URL params.
- **Traceable Scenarios**: `[SCENARIO-SUB-11]`

---

### Milestone 6: Admin Billing Management UI (Ticket-6)
- **Ticket ID**: `SUB-T6-ADMIN-UI`
- **Scope**:
  - Admin backend APIs under `monolith-backend/libs/admin`.
  - Frontend admin views in `frontend/src/features/admin/billing/`:
    - Plan Management: view all plans, edit monthly price and quota, toggle active status.
    - Subscription Oversight: view and search client subscriptions and statuses.
    - Payment Orders: view transaction logs with VNPay transaction numbers and response codes.
- **Traceable Scenarios**: `[SCENARIO-SUB-12]`
