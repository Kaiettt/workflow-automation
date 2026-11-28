# Technical Design: Ticket 2 - Execution Quota Enforcement

## 1. Concurrency & Row Locking Strategy
Để ngăn chặn tình trạng race condition khi nhiều webhook hoặc execution gửi đến cùng lúc:
- Sử dụng câu truy vấn khóa hàng trong PostgreSQL:
  ```sql
  SELECT id, total_quota, used_quota, manual_usage, webhook_usage
  FROM subscription_usages
  WHERE subscription_id = :subscriptionId
    AND period_start <= NOW()
    AND period_end >= NOW()
  FOR UPDATE;
  ```
- Nếu `used_quota < total_quota`:
  - `used_quota = used_quota + 1`
  - Nếu `triggerType === MANUAL`: `manual_usage = manual_usage + 1`
  - Nếu `triggerType === WEBHOOK`: `webhook_usage = webhook_usage + 1`
  - Commit transaction, trả về kết quả thành công.
- Nếu `used_quota >= total_quota`:
  - Rollback transaction, ném ra ngoại lệ `QuotaExceededException`.

## 2. Public Port & Seam Integration
- Port trong `libs/execution`:
  ```typescript
  export interface QuotaReservationPort {
    reserveExecutionQuota(userId: string, triggerType: TriggerType): Promise<void>;
  }
  ```
- Seam tại `ExecutionStarter` (`libs/execution/src/application/services/execution-starter.ts`):
  - Trước khi gọi `this.repository.createExecution(...)`:
  - Gọi `await this.quotaReservation.reserveExecutionQuota(workflowOwnerId, input.triggerType)`.
  - Nếu bắt gặp `QuotaExceededException`, không tạo execution và throw HTTP 429 (`HttpStatus.TOO_MANY_REQUESTS`).
- Webhook Seam:
  - Tương tự trong `ReceiveWebhookHandler` (`libs/triggers/src/application/commands/receive-webhook.command.ts`).
