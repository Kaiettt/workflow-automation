# Task & Evidence: Ticket 4 - Subscription Lifecycle Management

- [x] **Task 4.1**: Triển khai durable fulfillment cho `PaymentCompletedEvent` và nâng cấp subscription.
  - *Traceable Scenario*: `[SCENARIO-SUB-06]`
  - *Test*: `subscription-lifecycle.service.spec.ts` kiểm tra plan/quota/chu kỳ mới; `checkout-and-ipn.spec.ts` kiểm tra ghi outbox nguyên tử.
- [x] **Task 4.2**: Triển khai endpoints `downgrade`, `cancel`, và `switch-to-free`.
  - *Traceable Scenario*: `[SCENARIO-SUB-09]`, `[SCENARIO-SUB-10]`
  - *Test*: Unit test lifecycle kiểm tra lên lịch downgrade, hủy renewal và chuyển về Free; quota test phân biệt subscription `EXPIRED`.
- [x] **Task 4.3**: Triển khai BullMQ worker retry outbox, áp dụng downgrade, hết hạn gói trả phí và reset quota Free.
  - *Validation*: Prisma validate passed; focused Jest (5 suites, 32 tests) passed; `tsc --noEmit` passed; focused ESLint passed; `nest build` compiled successfully (reported sandbox `spawn EPERM` warnings). Migration: `20261128000000_subscription_lifecycle_outbox`.
