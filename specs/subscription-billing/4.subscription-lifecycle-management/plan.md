# Implementation Plan: Ticket 4 - Subscription Lifecycle Management

## Milestone
Hoàn thiện toàn bộ logic chuyển dịch trạng thái subscription (nâng cấp, hạ cấp, hủy, hết hạn, và chuyển về Free) cùng background worker định kỳ.

## Vertical Slices
1. **Slice 1**: `UpgradeSubscriptionHandler` kích hoạt khi thanh toán thành công.
2. **Slice 2**: Endpoints hạ cấp (`downgrade`), hủy renewal (`cancel`) và chuyển về gói Free (`switch-to-free`).
3. **Slice 3**: BullMQ repeatable job kiểm tra hết hạn và tự động reset chu kỳ cho gói Free.
