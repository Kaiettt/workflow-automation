# Task & Evidence: Payment Flow Observability

- [x] **1** Add structured, privacy-safe logs for checkout success/failure, VNPay IPN outcomes, and browser return verification. Trace: SC-PAY-OBS-01 through SC-PAY-OBS-04.
  - Red: new checkout/IPN/return assertions failed because the events were absent; one intermediate run also exposed that Nest Logger calls `error` separately from `log`, so the failure-event assertion was corrected to capture the right level.
  - Green: event tests pass, including checkout creation/failure, invalid IPN signature, successful order transition, and verified return. Assertions confirm sensitive values are omitted.
- [x] **2** Run focused payment tests, backend lint, type-check, and build; record actual results.
  - `npx jest --runInBand test/unit/payment`: 4 suites / 22 tests passed.
  - Targeted ESLint on the 3 modified payment handlers and payment handler test passed.
  - `npx tsc --noEmit --pretty false` passed.
  - `npx nest build` compiled successfully, with two environment `spawn EPERM` warnings.
  - `git diff --check` on scoped files passed.
