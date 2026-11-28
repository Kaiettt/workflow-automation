# Ticket 2: Execution Quota Enforcement

## 1. Overview
Triển khai cơ chế kiểm tra và trừ quota thực thi nguyên tử (atomic quota reservation) trước khi workflow được chấp nhận chạy. Chặn các yêu cầu thực thi khi quota của chu kỳ hiện tại đã hết (0 remaining).

## 2. Requirements & BDD Scenarios

### Scenario [SCENARIO-SUB-02]: Manual execution consumes 1 quota
- **Given** người dùng có subscription `ACTIVE` với 10 quota khả dụng
- **When** người dùng thực hiện chạy workflow thủ công (`MANUAL`)
- **Then** hệ thống trừ 1 quota nguyên tử
- **And** workflow execution được đưa vào hàng đợi `QUEUED`
- **And** `usedQuota` tăng lên 1, `manualUsage` tăng lên 1, quota còn lại là 9.

### Scenario [SCENARIO-SUB-03]: Webhook trigger consumes 1 quota
- **Given** workflow thuộc sở hữu của người dùng có 5 quota khả dụng nhận được sự kiện webhook
- **When** endpoint webhook tiếp nhận sự kiện
- **Then** 1 quota được trừ nguyên tử
- **And** workflow execution được đưa vào hàng đợi
- **And** `usedQuota` tăng lên 1, `webhookUsage` tăng lên 1, quota còn lại là 4.

### Scenario [SCENARIO-SUB-04]: Execution rejected when quota is exhausted
- **Given** người dùng có subscription `ACTIVE` nhưng còn 0 quota khả dụng
- **When** người dùng chạy workflow thủ công hoặc có webhook gọi đến
- **Then** hệ thống từ chối yêu cầu thực thi với HTTP 429 và mã lỗi `QUOTA_EXCEEDED`
- **And** không có bản ghi `Execution` nào được tạo hoặc đưa vào hàng đợi
- **And** số lượng quota đã dùng giữ nguyên không đổi.
