# Specification: Subscription & Billing with VNPAY

## 1. Overview & Objective

FlowPilot implements a **Freemium + Monthly Subscription** model, allowing clients to run automated workflows within defined execution quotas, purchase or upgrade subscription plans via **VNPAY Sandbox**, and monitor their quota consumption. Administrators manage pricing plans and oversee subscriptions and transactions.

### Core Billing Principle
> **1 accepted workflow execution = 1 quota unit**, regardless of the number of nodes or trigger type.
> Node retries within an execution do not consume extra quota. Failed executions still consume quota once accepted.

---

## 2. Subscription Plans

| Plan | Code | Monthly Price | Monthly Execution Quota | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Free** | `FREE` | 0 VND | 100 | Default plan granted upon successful user registration |
| **Starter** | `STARTER` | 99,000 VND | 1,000 | For individuals with growing automation needs |
| **Pro** | `PRO` | 299,000 VND | 5,000 | For power users running daily automations |
| **Business** | `BUSINESS` | 799,000 VND | 20,000 | For high-volume business workflows |

*Note: Pricing and quotas are configurable by Admin.*

---

## 3. Execution Quota Management

All trigger types share the monthly quota pool:
- `MANUAL`: Consumes 1 quota unit upon execution acceptance.
- `WEBHOOK`: Consumes 1 quota unit upon webhook reception and execution dispatch.
- `SCHEDULE`: Forward-compatible; consumes 1 quota unit when scheduled trigger runs.

### Quota Rules:
1. **Atomic Quota Reservation:** Quota check and decrement/usage increment must occur atomically via PostgreSQL row locking (`SELECT FOR UPDATE` on `SubscriptionUsage`) before an execution is enqueued.
2. **Quota Exhaustion Enforcement:** When remaining quota is 0:
   - Manual executions are rejected with error code `QUOTA_EXCEEDED` (HTTP 429/402).
   - Webhook trigger calls are rejected with HTTP 429 and error code `QUOTA_EXCEEDED`.
   - In-flight executions already accepted continue until completion.
3. **Monthly Reset:** Quotas reset at the start of each billing cycle without rollover.

---

## 4. Subscription Lifecycle

| Event | Trigger | Effect |
| :--- | :--- | :--- |
| **Auto Free Allocation** | User registers as `CLIENT` | Immediately creates an `ACTIVE` subscription on `FREE` plan with 1-month rolling cycle |
| **Upgrade** | Successful VNPAY payment for higher tier | Takes effect **immediately**. Starts a new 1-month billing cycle, resets quota to new plan limit. Prior unused quota does not roll over. |
| **Downgrade** | User chooses lower tier | Retains current plan and remaining quota until current cycle ends. At next billing cycle start, activates the downgraded plan. |
| **Cancel Renewal** | User cancels active paid subscription | Keeps current plan and quota until current cycle ends. Sets `autoRenew = false`. |
| **Expire** | Paid cycle ends without payment renewal | Subscription status changes to `EXPIRED`. Executions are blocked. User can renew or click **Switch to Free Plan**. |
| **Switch to Free** | User manually switches from `EXPIRED` to Free | Immediately activates `FREE` plan with standard 100 quota for a new 1-month cycle. |

---

## 5. Payment Integration (VNPAY Sandbox)

Follows `docs/integration/vnpay-integration.md`:
1. Client selects a plan to upgrade/renew.
2. Backend creates a `PaymentOrder` in `PENDING` status with a price snapshot.
3. Backend generates a signed VNPAY URL (`vnp_Command=pay`, `vnp_CurrCode=VND`, `vnp_Amount = price * 100`, HMAC-SHA512 checksum).
4. User completes payment on VNPAY Sandbox and is redirected to `Return URL` (Frontend display only).
5. VNPAY invokes backend `IPN URL` (Server-to-Server):
   - Backend validates HMAC-SHA512 checksum.
   - Checks order existence, matching amount, and current status.
   - If valid and `vnp_ResponseCode == "00"`, marks `PaymentOrder` as `COMPLETED`, applies subscription upgrade, and returns `{"RspCode":"00","Message":"Confirm Success"}`.
   - If duplicate IPN arrives, returns `{"RspCode":"02","Message":"Order already confirmed"}` without double-crediting quota.

---

## 6. Acceptance Criteria & BDD Scenarios

### Feature: User Registration & Default Free Plan Allocation

#### Scenario [SCENARIO-SUB-01]: Auto-assign Free plan upon registration
- **Given** a new user registers with role `CLIENT` and verifies their OTP
- **When** the account creation transaction completes
- **Then** a `Subscription` record is created for this user with plan `FREE` and status `ACTIVE`
- **And** a `SubscriptionUsage` record is initialized with `totalQuota = 100`, `usedQuota = 0`, and a 30-day billing period.

---

### Feature: Atomic Quota Reservation & Enforcement

#### Scenario [SCENARIO-SUB-02]: Manual execution consumes 1 quota
- **Given** a user has an active subscription with 10 remaining quota
- **When** the user manually triggers a workflow execution
- **Then** 1 quota unit is reserved atomically from their subscription
- **And** the execution is queued successfully with status `QUEUED`
- **And** the user's remaining quota becomes 9, with `manualUsage` incremented by 1.

#### Scenario [SCENARIO-SUB-03]: Webhook trigger consumes 1 quota
- **Given** a workflow owned by a user with 5 remaining quota receives an incoming webhook event
- **When** the webhook endpoint processes the event
- **Then** 1 quota unit is reserved atomically
- **And** the workflow execution is enqueued
- **And** the user's remaining quota becomes 4, with `webhookUsage` incremented by 1.

#### Scenario [SCENARIO-SUB-04]: Execution rejected when quota is exhausted
- **Given** a user has an active subscription with 0 remaining quota
- **When** the user attempts to run a workflow manually or a webhook arrives
- **Then** the system rejects the execution with status code 429 and error `QUOTA_EXCEEDED`
- **And** no new `Execution` record is created
- **And** quota usage remains unchanged.

---

### Feature: Payment Creation & VNPay Checkout

#### Scenario [SCENARIO-SUB-05]: Initiate payment order and generate payment URL
- **Given** an authenticated user on the `FREE` plan
- **When** the user selects the `PRO` plan (price 299,000 VND) and requests checkout
- **Then** a `PaymentOrder` is created with status `PENDING`, amount `299000`, and a unique `orderCode`
- **And** the backend returns a signed VNPay URL containing correct `vnp_Amount=29900000`, `vnp_TxnRef`, and valid `vnp_SecureHash`.

---

### Feature: IPN Webhook & Idempotent Payment Fulfillment

#### Scenario [SCENARIO-SUB-06]: Successful IPN activates subscription upgrade immediately
- **Given** a `PaymentOrder` in `PENDING` status for plan `PRO`
- **When** VNPay sends a valid IPN request with `vnp_ResponseCode="00"`, valid checksum, and matching amount
- **Then** the backend responds with `{"RspCode":"00","Message":"Confirm Success"}`
- **And** the `PaymentOrder` status is updated to `COMPLETED`
- **And** the user's subscription is updated to `PRO` with a new 30-day cycle
- **And** the quota is reset to 5,000 with `usedQuota = 0`.

#### Scenario [SCENARIO-SUB-07]: Duplicate IPN does not re-apply quota
- **Given** a `PaymentOrder` that has already been marked `COMPLETED`
- **When** VNPay sends an identical duplicate IPN request
- **Then** the backend returns `{"RspCode":"02","Message":"Order already confirmed"}`
- **And** the user's subscription and quota remain unchanged.

#### Scenario [SCENARIO-SUB-08]: Failed payment IPN leaves subscription unchanged
- **Given** a `PaymentOrder` in `PENDING` status
- **When** VNPay sends an IPN with `vnp_ResponseCode != "00"` (e.g. user cancelled)
- **Then** the `PaymentOrder` status is marked `FAILED`
- **And** the user's existing subscription and quota remain unchanged.

---

### Feature: Subscription Lifecycle (Downgrade, Cancel, Expiration)

#### Scenario [SCENARIO-SUB-09]: Downgrade takes effect at next billing cycle
- **Given** a user with an active `PRO` subscription
- **When** the user requests a downgrade to `STARTER`
- **Then** the subscription's `nextPlanId` is set to `STARTER`
- **And** the user remains on `PRO` with current quota until `currentPeriodEnd`.

#### Scenario [SCENARIO-SUB-10]: Expired subscription blocks execution and allows switch to Free
- **Given** a user whose paid subscription has passed `currentPeriodEnd` without renewal
- **When** the expiration scheduler runs
- **Then** the subscription status becomes `EXPIRED`
- **And** subsequent executions are blocked with `SUBSCRIPTION_EXPIRED`
- **When** the user clicks "Switch to Free Plan"
- **Then** their subscription transitions to `FREE` status `ACTIVE` with 100 fresh quota.

---

### Feature: Client & Admin Interfaces

#### Scenario [SCENARIO-SUB-11]: Client views billing dashboard and breakdown
- **Given** an authenticated user
- **When** the user opens the Billing Dashboard
- **Then** they see their current plan, billing period start/end, total/used/remaining quota
- **And** a breakdown of quota used by `MANUAL`, `WEBHOOK`, and `SCHEDULE`
- **And** a list of past payment transactions with status and date.

#### Scenario [SCENARIO-SUB-12]: Admin views transactions and updates plan prices
- **Given** an authenticated user with role `ADMIN`
- **When** the admin updates the price or quota of a subscription plan
- **Then** new payment orders use the updated price
- **And** existing active subscriptions retain their current cycle terms until renewal.
