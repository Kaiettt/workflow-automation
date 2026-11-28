# Task List & Test Evidence: Subscription & Billing with VNPAY

## Ticket 1: SUB-T1-FREE-TIER (Plan Catalog & Free Tier Provisioning)
- [ ] **Task 1.1: Prisma Schema & Migration**
  - Define `SubscriptionPlan`, `Subscription`, and `SubscriptionUsage` models in `schema.prisma`.
  - Generate Prisma migration and seed script for default plans (`FREE`, `STARTER`, `PRO`, `BUSINESS`).
  - *Verification*: `npx prisma validate && npx prisma migrate dev`
- [ ] **Task 1.2: Subscription Module Scaffold**
  - Create `monolith-backend/libs/subscription` with domain entities, repository port, and Prisma implementation.
  - *Test*: Unit test `PrismaSubscriptionRepository` and `SubscriptionService.allocateFreeSubscription`.
- [ ] **Task 1.3: Auth Registration Hook**
  - Update `RegisterHandler` in `monolith-backend/libs/auth` to allocate Free tier subscription on successful client registration.
  - *Traceable Scenario*: `[SCENARIO-SUB-01]`
  - *Test*: Unit test for `RegisterHandler` asserting subscription creation for `CLIENT` role.

---

## Ticket 2: SUB-T2-QUOTA-ENFORCE (Atomic Quota Reservation & Enforcement)
- [ ] **Task 2.1: Quota Reservation Domain Logic**
  - Implement `QuotaReservationPort` and `ReserveQuotaCommand`.
  - Use `SELECT ... FOR UPDATE` row-level lock on `subscription_usages` to ensure atomic check & decrement.
  - *Test*: Unit and concurrency tests for quota exhaustion and atomic increment.
- [ ] **Task 2.2: ExecutionStarter Seam Integration (Manual Triggers)**
  - Integrate `ExecutionStarter.start(...)` with `QuotaReservationPort`.
  - If quota reservation fails, reject with `QuotaExceededException` (HTTP 429).
  - *Traceable Scenario*: `[SCENARIO-SUB-02]`, `[SCENARIO-SUB-04]`
  - *Test*: Unit tests in `libs/execution` with mocked `QuotaReservationPort`.
- [ ] **Task 2.3: Webhook Trigger Quota Enforcement**
  - Intercept incoming webhooks in `ReceiveWebhookHandler`.
  - Verify and reserve quota before enqueuing execution. Reject with HTTP 429 when quota is 0.
  - *Traceable Scenario*: `[SCENARIO-SUB-03]`
  - *Test*: Unit test for `ReceiveWebhookHandler` when quota is exhausted.

---

## Ticket 3: SUB-T3-VNPAY-GATEWAY (VNPay Payment Integration & IPN)
- [ ] **Task 3.1: Payment Module Scaffold & PaymentOrder Schema**
  - Add `PaymentOrder` model in Prisma.
  - Create `monolith-backend/libs/payment` module.
  - *Test*: Repository tests for `PaymentOrder`.
- [ ] **Task 3.2: VNPay Client & Signature Utility**
  - Implement HMAC-SHA512 checksum generator, parameter URL encoder, and verification utility based on `docs/integration/vnpay-integration.md`.
  - *Traceable Scenario*: `[SCENARIO-SUB-05]`
  - *Test*: Unit test verifying checksum against standard VNPay test vectors.
- [ ] **Task 3.3: Checkout Endpoint (`POST /api/v1/billing/checkout`)**
  - Create `PENDING` payment order with price snapshot.
  - Return signed checkout URL.
  - *Test*: Controller & handler unit tests.
- [ ] **Task 3.4: Server-to-Server IPN Handler (`GET /api/v1/payments/vnpay/ipn`)**
  - Validate checksum, order code existence, amount match, and status.
  - Implement idempotent transition: return `RspCode 02` if order already completed.
  - Emit `PaymentCompletedEvent` upon successful verification.
  - *Traceable Scenario*: `[SCENARIO-SUB-06]`, `[SCENARIO-SUB-07]`, `[SCENARIO-SUB-08]`
  - *Test*: Unit tests for all IPN response codes (`00`, `01`, `02`, `04`, `97`).

---

## Ticket 4: SUB-T4-LIFECYCLE (Subscription Lifecycle Management)
- [ ] **Task 4.1: Immediate Plan Upgrade Handler**
  - Handle `PaymentCompletedEvent`: update subscription to new plan, reset cycle to `[now, now + 30 days]`, reset quota to plan limit.
  - *Traceable Scenario*: `[SCENARIO-SUB-06]`
  - *Test*: Unit test for `UpgradeSubscriptionHandler`.
- [ ] **Task 4.2: Downgrade & Cancellation Scheduling**
  - Implement `POST /api/v1/billing/subscription/downgrade` (sets `nextPlanId`).
  - Implement `POST /api/v1/billing/subscription/cancel` (sets `autoRenew = false`).
  - *Traceable Scenario*: `[SCENARIO-SUB-09]`
  - *Test*: Unit test ensuring plan stays active until cycle end.
- [ ] **Task 4.3: Expiration & Monthly Reset Scheduler**
  - Scheduled job to sweep expired subscriptions: set status to `EXPIRED`.
  - Reset monthly quota for `ACTIVE` Free subscriptions.
  - Implement `POST /api/v1/billing/subscription/switch-to-free` to allow expired users to reactivate Free tier.
  - *Traceable Scenario*: `[SCENARIO-SUB-10]`
  - *Test*: Unit tests for expiration sweep and switch-to-free handler.

---

## Ticket 5: SUB-T5-CLIENT-UI (Client Billing Dashboard)
- [ ] **Task 5.1: Billing API Client & React Query Hooks**
  - Create endpoints client in `frontend/src/features/billing/api`.
  - *Test*: Component mock tests.
- [ ] **Task 5.2: Subscription Overview & Quota Progress Component**
  - Display current plan, expiration date, used/total quota bar, and trigger breakdown.
  - *Traceable Scenario*: `[SCENARIO-SUB-11]`
- [ ] **Task 5.3: Pricing Plan Selection & VNPay Checkout Flow**
  - Pricing cards grid with Upgrade/Downgrade buttons.
  - Redirect user to VNPay payment URL.
- [ ] **Task 5.4: Payment Result Page & Transaction History**
  - Handle redirect from VNPay (`/billing/payment-result`).
  - Transaction history table with status badges.

---

## Ticket 6: SUB-T6-ADMIN-UI (Admin Billing Management)
- [x] **Task 6.1: Admin Billing Endpoints**
  - Implement admin endpoints for plan modification, subscription search, and payment order audits.
- [x] **Task 6.2: Admin Plan Management UI**
  - Table of plans, edit price/quota modal, enable/disable toggle.
  - *Traceable Scenario*: `[SCENARIO-SUB-12]`
- [x] **Task 6.3: Admin Subscription & Payment Oversight UI**
  - Searchable, paginated tables for user subscriptions and payment logs.
- [x] **Task 6.4: Revenue Summary and Admin Route Integration**
  - Completed-payment revenue by plan; register Billing under the protected Admin Portal.
  - See [Ticket 6 task evidence](6.admin-billing-management/task.md).
