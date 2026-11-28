# Technical Design: Ticket 4 - Subscription Lifecycle Management

## 1. Event Consumer: Payment Fulfillment
- IPN chuyển đơn hàng sang `COMPLETED` và ghi `PaymentCompletedEvent` vào `billing_outbox_events` trong cùng transaction.
- BullMQ worker đọc lại các sự kiện chưa xử lý và gọi use case fulfillment. Ghi nhận `orderCode` duy nhất trong `subscription_payment_fulfillments` cùng thay đổi subscription và usage để bảo đảm idempotency.
- Fulfillment xử lý `PaymentCompletedEvent(userId, planId, orderCode)`:
  - Tra cứu gói `SubscriptionPlan` mới theo `planId`.
  - Cập nhật `Subscription`:
    - `planId = newPlanId`
    - `status = ACTIVE`
    - `currentPeriodStart = now`
    - `currentPeriodEnd = now + 30 days`
    - `nextPlanId = null` (xóa lịch downgrade nếu có)
  - Tạo bản ghi mới trong `subscription_usages`:
    - `total_quota = newPlan.monthlyQuota`
    - `used_quota = 0`
    - `period_start = now`, `period_end = now + 30 days`.

## 2. Downgrade & Cancellation Scheduling
- Endpoint `POST /api/v1/billing/subscription/downgrade`:
  - Body: `{ "targetPlanCode": "STARTER" }`
  - Gán `subscription.nextPlanId = targetPlan.id`.
- Endpoint `POST /api/v1/billing/subscription/cancel`:
  - Gán `subscription.autoRenew = false` và xóa `nextPlanId` đang chờ. Quyền lợi còn lại đến hết chu kỳ; nếu không có thanh toán mới thì scheduler chuyển sang `EXPIRED`.

## 3. Expiration & Monthly Reset Scheduler
- Sử dụng BullMQ repeatable job (chạy mỗi giờ hoặc mỗi ngày):
  1. **Áp dụng downgrade**:
     - Query active subscriptions đã quá hạn có `nextPlanId`.
     - Chuyển sang plan đích, bắt đầu chu kỳ 30 ngày mới và cấp đủ quota của plan đích.
  2. **Hết hạn gói trả phí**:
     - Các subscription trả phí active đã quá hạn, không có `nextPlanId`, chuyển sang `EXPIRED`.
  3. **Reset gói Free**:
     - Query: `WHERE status = 'ACTIVE' AND plan.code = 'FREE' AND current_period_end < NOW()`.
     - Update: gia hạn chu kỳ thêm 30 ngày, reset usage 100 quota.
- Job scheduler cũng retry outbox chưa xử lý; retry an toàn nhờ fulfillment `orderCode` duy nhất.

## 4. Switch to Free Endpoint
- Endpoint `POST /api/v1/billing/subscription/switch-to-free`:
  - Điều kiện: `subscription.status === EXPIRED`.
  - Hành động: Gán `planId = freePlan.id`, `status = ACTIVE`, cấp chu kỳ mới và 100 quota.
