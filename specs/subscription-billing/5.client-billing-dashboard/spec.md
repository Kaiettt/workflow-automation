# Ticket 5: Client Billing Dashboard

## Requirements

The authenticated Client can view the current subscription and billing period, quota totals and usage by trigger type, active plans and their prices, and payment history. Checkout and lifecycle actions use the authenticated billing API. Payment return status is based only on the server order record; query parameters are not proof of payment.

## Acceptance criteria and BDD scenarios

### AC-5.1 — Current plan and quota dashboard (`SCENARIO-SUB-11`)
Given an authenticated Client with a subscription and current usage, when they open `/billing`, then the page shows the current plan and period dates, used/total/remaining quota, MANUAL/WEBHOOK/SCHEDULE usage, available plan pricing and payment history. Loading, empty, and recoverable error states are shown intentionally.

### AC-5.2 — Checkout and verified return (`SCENARIO-SUB-11-PAY`)
Given an authenticated Client selects a higher-priced plan, when checkout returns a secure payment URL, then the browser navigates to it. When VNPay returns the browser to `/billing/payment-result?txnRef=...`, the backend verifies and processes the signed result through the same idempotent settlement used by IPN before redirecting. The page fetches the authenticated order and displays its persisted status. A URL response code alone never shows payment success. IPN remains available when the customer does not return, and pending orders are refreshed a bounded number of times.

### AC-5.3 — Plan lifecycle actions (`SCENARIO-SUB-11-LIFECYCLE`)
Given an active subscription, when the Client selects a lower-priced plan, then the backend schedules it for the next billing cycle and the page confirms that outcome. Given an expired paid subscription, when the Client switches to Free, then the page refreshes subscription data and shows the Free plan.

### AC-5.4 — User-scoped history and subscription data (`SCENARIO-SUB-11-API`)
Given an authenticated Client requests their billing data, then subscription, usage, order lookup, and payment history are scoped to the authenticated user. The history response contains only public billing fields.
