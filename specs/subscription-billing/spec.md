## **1. Objective**

Build a **Freemium + Monthly Subscription** system for FlowPilot, allowing users to purchase plans, pay through VNPAY, and manage workflow execution limits (Execution Quota).

Core billing principle:

> **1 accepted workflow execution = 1 quota unit**, regardless of the number of nodes or trigger type.

## **2. Subscription Plans**

| Plan    | Monthly Price | Execution Quota |
| ------- | ------------- | --------------- |
| Free    | 0 VND         | 100             |
| Starter | 99,000 VND    | 1,000           |
| Pro     | 299,000 VND   | 5,000           |
| Power   | 799,000 VND   | 20,000          |

These are configurable demo values for the MVP, not official commercial pricing.

- All plans provide the same core features.
- Plans differ only in execution quota.
- There is no limit on the number of workflows.
- Every newly registered user automatically receives the Free Plan.

## **3. Execution Quota Management**

All three trigger types share the same execution quota:

| Trigger Type          | Quota Consumption                         |
| --------------------- | ----------------------------------------- |
| Manual                | 1 quota per accepted execution            |
| Webhook               | 1 quota per accepted webhook event        |
| Background / Schedule | 1 quota per accepted scheduled occurrence |

**Key rules:**

- Accepted executions consume quota, even if execution later fails.
- Node retries within the same execution do not consume additional quota.
- Manually rerunning a workflow creates a new execution and consumes another quota.
- Invalid or rejected requests do not consume quota.
- Quota resets monthly according to the billing cycle, with no rollover.
- The backend must perform quota checks and consumption atomically to prevent exceeding limits under concurrent requests.

When the quota is exhausted:

- Manual and Webhook triggers cannot create new executions.
- Background/Schedule triggers temporarily pause new scheduled executions.
- Scheduled executions resume after quota reset.
- Missed scheduled occurrences are not replayed.
- Previously accepted executions are allowed to finish.

## **4. Subscription Lifecycle**

| Action    | Behavior                                                                                      |
| --------- | --------------------------------------------------------------------------------------------- |
| Upgrade   | Full payment for the new plan; takes effect immediately after successful payment verification |
| Downgrade | Takes effect at the beginning of the next billing cycle                                       |
| Cancel    | Stops renewal while preserving access until the current cycle ends                            |
| Renew     | Requires manual payment                                                                       |
| Expire    | Blocks new executions while preserving existing data                                          |

**Upgrade rules:**

- A new billing cycle starts immediately.
- Quota resets according to the new plan.
- Unused quota and remaining time from the previous plan are not carried over.
- If payment fails, the current subscription remains unchanged.

The MVP does not automatically downgrade expired subscriptions to the Free Plan.

## **5. Payment Integration**

Integrate **VNPAY Sandbox** for payment processing.

Payment flow:

1. The user selects a subscription plan.
2. The backend retrieves the plan price from the database.
3. The backend creates a Payment Order.
4. The user is redirected to VNPAY.
5. VNPAY processes the transaction.
6. The backend receives an IPN notification and verifies its signature, transaction reference, and amount.
7. If verification succeeds, the Payment Order and Subscription are updated.

**Important rules:**

- Never trust payment amounts submitted by the frontend.
- Only a valid IPN notification can confirm successful payment.
- The Return URL is only for displaying payment results, not confirming payment.
- Duplicate IPN notifications must not activate subscriptions or grant quota multiple times.
- Store a snapshot of the plan and price when the Payment Order is created.

## **6. Main Interfaces**

### **Client Billing Dashboard**

Users can:

- View their current plan and billing cycle.
- Check total, used, and remaining execution quota.
- View usage breakdown by Manual / Webhook / Background.
- Browse available subscription plans.
- Upgrade, downgrade, or cancel subscriptions.
- View payment history.

### **Admin Billing**

Administrators can:

- Create, update, and enable/disable subscription plans.
- Search and view subscriptions.
- Search and view Payment Orders.
- Monitor revenue and subscription statistics by plan.

Admin Billing does not grant access to workflow definitions, execution payloads, or credentials.

## **7. MVP Scope**

In Scope

- Free and paid subscription plans.
- Subscription lifecycle management.
- Monthly billing cycles and quota resets.
- Execution quota enforcement.
- VNPAY Sandbox integration and IPN verification.
- Upgrade, downgrade, cancellation, and manual renewal.
- Client Billing Dashboard.
- Payment History.
- Admin Billing.

Out of Scope

- Automatic recurring payments.
- Annual subscriptions.
- AI credits.
- Overage billing.
- Team / Organization plans.
- Enterprise billing.
- Weighted execution pricing.
- Workflow count limits.

## **8. Important Technical Requirements**

The following areas require particular attention during implementation:

1. **Atomic Quota Reservation:** Prevent concurrent requests from exceeding the quota limit.
2. **Payment Idempotency:** Duplicate IPN notifications must not grant subscriptions or quota multiple times.
3. **Data Consistency:** Payment Orders and Subscriptions must be updated consistently.
4. **Security:** Verify VNPAY signatures, enforce Client/Admin authorization, and protect VNPAY secrets.
5. **Auditability:** Maintain traceable records of payment and subscription lifecycle changes.
6. **Reliability:** Handle duplicate callbacks and transient processing failures safely.

## **9. Items to Confirm Before Implementation**

- The current SRS uses `Business` as the fourth plan, while this specification uses `Power`. These should be aligned.
- The existing technical notes confirm Manual and Webhook execution flows. The actual implementation status of Schedule execution still needs verification.
- Subscription and Payment Order statuses proposed in this specification should be validated against the database design during implementation.