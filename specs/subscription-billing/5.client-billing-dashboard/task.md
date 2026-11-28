# Task & Evidence: Ticket 5 — Client Billing Dashboard

- [x] **Task 5.1:** Add billing APIs and query hooks; add CQRS read APIs for current subscription and user-scoped payment history.
  - Trace: `SCENARIO-SUB-11-API`
  - Tests: Subscription and payment history CQRS query tests passed.
- [x] **Task 5.2:** Build quota card, pricing grid, expired banner, history table, and dashboard route/navigation.
  - Trace: `SCENARIO-SUB-11`, `SCENARIO-SUB-11-LIFECYCLE`
  - Tests: quota, plan action, and payment history component tests passed.
- [x] **Task 5.3:** Build server-verified payment result and checkout redirect.
  - Trace: `SCENARIO-SUB-11-PAY`
  - Tests: payment result tests passed, including rejection of URL-only success.
- [x] **Task 5.4:** Apply valid browser-return results through the existing idempotent payment transition while retaining IPN fallback.
  - Trace: `SC-PAY-RETURN-01`, `SC-PAY-RETURN-02`, `SC-PAY-RETURN-03` in `specs/payment-return-settlement/spec.md`.
  - Evidence: 4 payment Jest suites / 24 tests passed, including valid return settlement and invalid-signature rejection; backend lint, type-check, and build passed (with two `spawn EPERM` warnings from Nest build).

## Validation evidence

- `frontend`: `npm test -- --run src/features/billing/components/QuotaUsageCard.test.tsx src/features/billing/components/PricingPlansGrid.test.tsx src/features/billing/components/PaymentHistoryTable.test.tsx src/features/billing/pages/PaymentResultPage.test.tsx` — passed, 4 files / 5 tests.
- `frontend`: `npm run build` — passed ESLint, TypeScript build, and Vite production build. Vite reports the existing large-chunk warning (main JS bundle about 1.39 MB).
- `frontend`: targeted ESLint and `npx tsc -b` — passed.
- `monolith-backend`: `npx jest --runInBand test/unit/subscription/get-current-subscription.query.spec.ts test/unit/payment/get-payment-history.query.spec.ts` — passed, 2 suites / 3 tests.
- `monolith-backend`: targeted ESLint — passed.
- `monolith-backend`: `npx nest build` — exited successfully; emitted two `spawn EPERM` warnings before successful webpack compilation.
- `git diff --check` reports trailing whitespace in the pre-existing unrelated `logs/ai-sessions/latest.md`; it did not identify Ticket 5 whitespace issues.
