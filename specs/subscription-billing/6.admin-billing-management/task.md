# Task & Evidence: Admin Billing Management

- [x] **6.1** Add `SubscriptionPlan.revision` migration and audited update command with validation, stale-revision conflict, and no-op behavior. Trace: SCENARIO-SUB-12, SCENARIO-SUB-12-STALE.
  - Red: the first focused Jest run could not resolve the missing command; because it failed before assertions, it is recorded as a discovery failure rather than a behavioral Red.
  - Green: focused repository tests cover success/audit, stale revision, and no-op; all pass.
- [x] **6.2** Add bounded admin queries for plans, subscriptions, payments, and completed revenue; restrict selected fields. Trace: SCENARIO-SUB-12-SEARCH, SCENARIO-SUB-12-REVENUE.
  - Red: the subscription controller test failed because email search retained surrounding whitespace; the controller now trims the query before dispatch.
  - Green: repository projections select billing fields only; revenue groups completed orders by recorded plan and payment date. Backend admin suite passed.
- [x] **6.3** Expose DTO-validated, ADMIN-protected billing endpoints and verify role/validation behavior. Trace: SCENARIO-SUB-12-AUTH.
  - Green: controller dispatch and class metadata test confirms JWT and ADMIN guards; focused admin tests passed.
- [x] **6.4** Add admin billing API/hooks and plan catalog/edit UI. Trace: SCENARIO-SUB-12.
  - Green: frontend billing page test covers plans default view and tab switching; frontend type-check and targeted lint passed.
- [x] **6.5** Add subscription, payment, and revenue views; add Admin route and navigation. Trace: SCENARIO-SUB-12-SEARCH, SCENARIO-SUB-12-REVENUE.
  - Green: frontend test covers revenue date controls; subscription/payment views implement email/status/plan and status/date filters with pagination.
- [x] **6.6** Run focused tests, lint, type checking, Prisma validation, and builds; verify acceptance criteria and update this evidence.
  - Backend: 5 focused admin Jest suites / 32 tests passed; `npx tsc --noEmit` passed; targeted ESLint passed; `npx nest build` compiled successfully with two `spawn EPERM` warnings; `npx prisma generate`, `npx prisma format`, and `npx prisma validate` passed.
  - Frontend: 2 focused Vitest files / 3 tests passed with the repository configuration outside the sandbox; `npm run build` passed (including lint and type-check). Vite reports the main bundle exceeds 500 kB.
