# Task & Evidence: Verified Payment Return Settlement

- [x] **1** Process verified browser returns through the same idempotent settlement logic as IPN and log the source. Trace: SC-PAY-RETURN-01 through SC-PAY-RETURN-03.
  - Red: focused test failed because a valid return never dispatched payment settlement.
  - Green: return now dispatches the existing callback transition with source `return`; invalid signatures do not dispatch. The shared conditional repository transition and outbox retain duplicate safety.
- [x] **2** Run payment tests, backend lint, type-check, and build; record actual results.
  - `npx jest --runInBand test/unit/payment`: 4 suites / 24 tests passed.
  - Targeted ESLint on the 2 callback handlers and payment handler tests passed.
  - `npx tsc --noEmit --pretty false` passed.
  - `npx nest build` compiled successfully, with two environment `spawn EPERM` warnings.
  - `git diff --check` on scoped files passed.
