# Task & Evidence: Ticket 2 - Execution Quota Enforcement

- [x] **Task 2.1**: Triển khai `QuotaEnforcer` với logic `SELECT FOR UPDATE` và ném `QuotaExceededException`.
  - *Test Red/Green*: Unit test `quota-enforcer.spec.ts` kiểm tra thành công, trừ đúng trigger type, và ném lỗi khi `used >= total` -> Passed (3 tests)
- [x] **Task 2.2**: Cắm seam vào `ExecutionStarter.start(...)` trong `libs/execution`.
  - *Traceable Scenario*: `[SCENARIO-SUB-02]`, `[SCENARIO-SUB-04]`
  - *Test Red/Green*: Unit test `execution-starter.spec.ts` với mock `QuotaReservationPort` (thành công vs bị từ chối 429) -> Passed (7 tests)
- [x] **Task 2.3**: Cắm seam vào `ReceiveWebhookHandler` trong `libs/triggers`.
  - *Traceable Scenario*: `[SCENARIO-SUB-03]`
  - *Test Red/Green*: Unit test `receive-webhook.spec.ts` kiểm tra trả về 429 khi quota người sở hữu workflow đã cạn -> Passed (2 tests)
