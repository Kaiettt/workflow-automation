# Tài liệu Đặc tả Quản lý Gói dịch vụ và Thanh toán VNPAY (Subscription & Billing Specs)

Thư mục này chứa toàn bộ tài liệu đặc tả, thiết kế kiến trúc, kế hoạch triển khai và checklist công việc cho hệ thống **Subscription & Billing with VNPAY** của FlowPilot.

Cấu trúc được chia nhỏ thành 6 tickets thành phần độc lập, được **đánh số theo đúng thứ tự triển khai** (mỗi ticket bao gồm `spec.md`, `design.md`, `plan.md`, `task.md`):

---

## Danh sách 6 Tickets Triển khai

1. [1.subscription-foundation-and-free-tier/](1.subscription-foundation-and-free-tier/):
   - **Mục tiêu**: Schema database (`SubscriptionPlan`, `Subscription`, `SubscriptionUsage`), seed 4 gói (`FREE`, `STARTER`, `PRO`, `BUSINESS`), module `libs/subscription`, và hook tự động cấp gói Free khi người dùng đăng ký vai trò `CLIENT`.
   - [spec.md](1.subscription-foundation-and-free-tier/spec.md) | [design.md](1.subscription-foundation-and-free-tier/design.md) | [plan.md](1.subscription-foundation-and-free-tier/plan.md) | [task.md](1.subscription-foundation-and-free-tier/task.md)

2. [2.execution-quota-enforcement/](2.execution-quota-enforcement/):
   - **Mục tiêu**: Cơ chế kiểm tra và trừ quota nguyên tử (PostgreSQL `SELECT FOR UPDATE`), tích hợp `QuotaReservationPort` vào `ExecutionStarter`, chặn thực thi workflow (HTTP 429) cho Manual và Webhook khi hết quota.
   - [spec.md](2.execution-quota-enforcement/spec.md) | [design.md](2.execution-quota-enforcement/design.md) | [plan.md](2.execution-quota-enforcement/plan.md) | [task.md](2.execution-quota-enforcement/task.md)

3. [3.vnpay-payment-gateway/](3.vnpay-payment-gateway/):
   - **Mục tiêu**: Module độc lập `libs/payment`, schema `PaymentOrder`, tiện ích ký SHA-512 VNPAY, endpoint tạo đơn thanh toán (`/checkout`), endpoint IPN webhook server-to-server bảo đảm idempotency và phát `PaymentCompletedEvent`.
   - [spec.md](3.vnpay-payment-gateway/spec.md) | [design.md](3.vnpay-payment-gateway/design.md) | [plan.md](3.vnpay-payment-gateway/plan.md) | [task.md](3.vnpay-payment-gateway/task.md)

4. [4.subscription-lifecycle-management/](4.subscription-lifecycle-management/):
   - **Mục tiêu**: Nâng cấp tức thì (reset chu kỳ và hạn mức), lên lịch hạ cấp vào cuối chu kỳ (`nextPlanId`), hủy gia hạn, BullMQ cron sweep hết hạn (`EXPIRED`) và endpoint cho phép người dùng chuyển về Free khi gói hết hạn.
   - [spec.md](4.subscription-lifecycle-management/spec.md) | [design.md](4.subscription-lifecycle-management/design.md) | [plan.md](4.subscription-lifecycle-management/plan.md) | [task.md](4.subscription-lifecycle-management/task.md)

5. [5.client-billing-dashboard/](5.client-billing-dashboard/):
   - **Mục tiêu**: Giao diện Client xem gói hiện tại, thanh tiến độ quota (used/remaining), breakdown loại trigger, bảng giá nâng cấp/hạ cấp, chuyển hướng VNPAY Sandbox, xử lý Return URL và lịch sử thanh toán.
   - [spec.md](5.client-billing-dashboard/spec.md) | [design.md](5.client-billing-dashboard/design.md) | [plan.md](5.client-billing-dashboard/plan.md) | [task.md](5.client-billing-dashboard/task.md)

6. [6.admin-billing-management/](6.admin-billing-management/):
   - **Mục tiêu**: Giao diện và API Admin quản trị giá/quota danh mục gói, tra cứu tìm kiếm danh sách subscription của người dùng và nhật ký đơn hàng thanh toán VNPAY.
   - [spec.md](6.admin-billing-management/spec.md) | [design.md](6.admin-billing-management/design.md) | [plan.md](6.admin-billing-management/plan.md) | [task.md](6.admin-billing-management/task.md)

---

## Tài liệu Đặc tả Tổng thể

- [spec.md](spec.md): Đặc tả tổng quan yêu cầu, bảng giá, quy tắc quota, vòng đời và 12 kịch bản BDD chuẩn (`[SCENARIO-SUB-01]` đến `[SCENARIO-SUB-12]`).
- [design.md](design.md): Thiết kế kỹ thuật tổng thể, sơ đồ tuần tự, schema Prisma, API contracts và material test seams.
- [plan.md](plan.md): Lộ trình triển khai tổng thể 6 milestones.
- [task.md](task.md): Danh mục công việc tổng thể và theo dõi bằng chứng kiểm thử TDD.
