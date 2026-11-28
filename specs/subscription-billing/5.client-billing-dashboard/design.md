# Technical Design: Ticket 5 — Client Billing Dashboard

## Frontend

Feature-owned code lives in `frontend/src/features/billing/`: API functions and TanStack Query hooks, explicit response types, quota and pricing components, history table, dashboard page, and payment result page. `App.tsx` composes `/billing` and `/billing/payment-result`; the Client account dropdown links to billing.

The existing shared Axios client supplies authentication. Query keys are feature-scoped. Mutations invalidate the smallest applicable subscription query. Checkout accepts only an HTTPS payment URL before navigation. The return page uses `txnRef` to query the authenticated order endpoint and displays only the server's status. Pending orders poll at two-second intervals for at most ten successful observations, then stop.

## Backend

`GET /api/billing/subscription/me` dispatches `GetCurrentSubscriptionQuery` in the Subscription module. Its handler maps the user's subscription and current usage to an explicit DTO without returning the user ID or persistence model. `GET /api/billing/payments/history` dispatches a Payment query that calls `findByUserId` and maps safe order fields. Existing authenticated order lookup remains the payment-result source. The backend verifies the signed VNPay return and runs the same conditional payment-order transition used by IPN before redirecting; both callbacks can safely race or arrive more than once. IPN remains the server-to-server fallback when the browser does not return. Existing checkout, downgrade, and switch-to-free endpoints are reused.

## Test seams

- Subscription query handler with a repository port fake verifies user scoping, mapping, null subscription, and usage mapping.
- Quota component test verifies displayed quota and trigger breakdown.
- Payment-result page test verifies server-confirmed success and rejects URL-only success.
- Existing billing API is isolated behind the shared HTTP client for component/query behavior.
