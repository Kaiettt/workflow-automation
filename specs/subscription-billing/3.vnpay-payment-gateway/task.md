# Task & Evidence: Ticket 3 - VNPay Payment Gateway & Idempotent IPN Webhook

- [x] **Task 3.1**: Bổ sung `PaymentOrder` vào schema Prisma và migration.
  - *Verify*: `npx prisma validate` & `npx prisma db push` -> Done (Prisma schema in sync)
- [x] **Task 3.2**: Triển khai `VNPayUtil` & `VNPayService` (tạo chữ ký HMAC-SHA512, verify chữ ký, URL builder).
  - *Test Red/Green*: Unit test `vnpay-signer.spec.ts` & `vnpay-service.spec.ts` -> Passed (6 tests)
- [x] **Task 3.3**: Triển khai `CreateCheckoutHandler` và endpoint `POST /api/billing/checkout`.
  - *Traceable Scenario*: `[SCENARIO-SUB-05]`
  - *Test Red/Green*: Unit test `checkout-and-ipn.spec.ts` kiểm tra tạo đơn PENDING và URL checkout -> Passed (3 tests)
- [x] **Task 3.4**: Triển khai `HandleVNPayIpnHandler`, `VerifyVNPayReturnHandler` và endpoints `GET /api/billing/vnpay/ipn`, `GET /api/billing/vnpay/return`.
  - *Traceable Scenario*: `[SCENARIO-SUB-06]`, `[SCENARIO-SUB-07]`, `[SCENARIO-SUB-08]`
  - *Test Red/Green*: Unit tests cover IPN response codes (`00`, `01`, `02`, `04`, `97`), failed payments, and concurrent duplicate callbacks -> Passed.
  - Payment state changes use an atomic repository transition; successful transitions publish `PaymentCompletedEvent` with `userId`, `planId`, and `orderCode`.
- [x] **Task 3.5**: Require explicit VNPay environment configuration and document the no-default contract.
  - *Verify*: `getVNPayConfig()` rejects missing required values; integration guide documents required settings and startup validation.
- [x] **Task 3.6**: Keep billing application services independent of Prisma persistence.
  - *Verify*: Payment IPN persistence and quota reservation are repository-owned; focused backend build succeeded.
- **Validation evidence**: Payment/subscription unit tests: 29 passed; focused ESLint: passed; `npx nest build`: succeeded.
