# Ticket 4: Subscription Lifecycle Management

## 1. Overview
Quản lý vòng đời đầy đủ của gói dịch vụ: nâng cấp gói ngay khi thanh toán thành công, lên lịch hạ cấp vào cuối chu kỳ, hủy gia hạn, quét hết hạn bằng background job và hỗ trợ người dùng chuyển về gói Free khi gói hết hạn.

## 2. Requirements & BDD Scenarios

### Scenario [SCENARIO-SUB-06-LIFECYCLE]: Immediate plan upgrade upon payment
- **Given** người dùng nhận được sự kiện `PaymentCompletedEvent` cho gói `PRO`
- **When** hệ thống xử lý nâng cấp subscription
- **Then** gói dịch vụ của người dùng được cập nhật sang `PRO`
- **And** chu kỳ mới 30 ngày được thiết lập bắt đầu từ thời điểm hiện tại
- **And** bản ghi `SubscriptionUsage` mới được tạo với hạn mức đầy đủ của gói `PRO` (5.000 quota) và `usedQuota = 0`
- **And** thời gian còn lại và quota chưa dùng của gói cũ bị hủy bỏ (không cộng dồn).

### Scenario [SCENARIO-SUB-09]: Downgrade takes effect at next billing cycle
- **Given** người dùng đang ở gói `PRO` còn hạn sử dụng
- **When** người dùng yêu cầu hạ cấp xuống gói `STARTER`
- **Then** trường `nextPlanId` của subscription được gán bằng `STARTER`
- **And** người dùng vẫn giữ nguyên gói `PRO` và quota còn lại cho đến `currentPeriodEnd`.

### Scenario [SCENARIO-SUB-10]: Expired subscription blocks execution and allows switch to Free
- **Given** gói dịch vụ trả phí của người dùng đã quá `currentPeriodEnd` mà chưa gia hạn
- **When** cron job quét hết hạn thực thi
- **Then** trạng thái subscription chuyển sang `EXPIRED`
- **And** các lượt chạy workflow tiếp theo bị chặn với lỗi `SUBSCRIPTION_EXPIRED` (HTTP 402)
- **When** người dùng bấm "Chuyển về gói Free" (`POST /api/v1/billing/subscription/switch-to-free`)
- **Then** trạng thái subscription chuyển thành `ACTIVE` với gói `FREE` và 100 quota chu kỳ mới.

### Scenario [SCENARIO-SUB-09-CANCEL]: Cancellation expires a paid plan at cycle end
- **Given** người dùng có subscription trả phí đang `ACTIVE`
- **When** người dùng hủy gia hạn
- **Then** `autoRenew` chuyển thành `false`, lịch hạ cấp đang chờ bị xóa, và quyền lợi hiện tại được giữ đến `currentPeriodEnd`
- **And** scheduler chuyển subscription sang `EXPIRED` khi chu kỳ kết thúc nếu chưa có thanh toán mới.

### Scenario [SCENARIO-SUB-06-OUTBOX]: Payment fulfillment survives process failure
- **Given** IPN hợp lệ chuyển một PaymentOrder sang `COMPLETED`
- **When** tiến trình dừng trước khi subscription được nâng cấp
- **Then** sự kiện thanh toán vẫn nằm trong outbox chưa xử lý và được thử lại bởi worker
- **And** xử lý lặp cùng `orderCode` chỉ áp dụng subscription và quota một lần.
