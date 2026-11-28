# Task & Evidence: Quota Reservation Diagnostics

- [x] **1** Add privacy-safe structured logs for quota reservation denials. Trace: SC-QUOTA-LOG-01 and SC-QUOTA-LOG-02.
  - Red: focused tests failed because missing and non-ACTIVE subscription results had no diagnostic event.
  - Green: `reserveQuota` now logs whether a subscription exists, its state, and trigger type for `NO_ACTIVE_SUBSCRIPTION`; it also logs expired subscription, missing period, and exhausted quota reasons. User IDs are omitted.
- [x] **2** Run focused subscription tests, backend lint, type-check, and build; record actual results.
  - `npx jest --runInBand test/unit/subscription`: 5 suites / 23 tests passed.
  - Targeted ESLint passed for the repository and quota reservation tests.
  - `npx tsc --noEmit --pretty false` passed.
  - `npx nest build` compiled successfully, with two environment `spawn EPERM` warnings.
