# Implementation Plan: Ticket 2 - Execution Quota Enforcement

## Milestone
Hoàn thành cơ chế trừ quota nguyên tử và tích hợp bảo vệ vào luồng chạy workflow (`Manual` và `Webhook`), đảm bảo không có execution nào được chạy khi hết quota.

## Vertical Slices
1. **Slice 1**: `QuotaEnforcer` service với giao dịch `SELECT FOR UPDATE` trong `libs/subscription`.
2. **Slice 2**: Tích hợp `QuotaReservationPort` vào `ExecutionStarter` cho Manual trigger.
3. **Slice 3**: Tích hợp kiểm tra quota vào `ReceiveWebhookHandler` cho Webhook trigger.
