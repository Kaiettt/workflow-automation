# Ticket 3: VNPay Payment Gateway & Idempotent IPN Webhook

## 1. Overview
Xây dựng module thanh toán độc lập `libs/payment` tích hợp với VNPAY Sandbox theo chuẩn [vnpay-integration.md](file:///c:/project/tlcn/workflow-automation/docs/integration/vnpay-integration.md). Quản lý đơn thanh toán (`PaymentOrder`), sinh URL checkout có mã hash HMAC-SHA512, và tiếp nhận callback IPN server-to-server bảo đảm tính idempotent.

## 2. Requirements & BDD Scenarios

### Scenario [SCENARIO-SUB-05]: Initiate payment order and generate payment URL
- **Given** người dùng đăng nhập đang sử dụng gói `FREE`
- **When** người dùng chọn gói `PRO` (giá 299.000 VND) và gửi yêu cầu tạo checkout
- **Then** một `PaymentOrder` được tạo với trạng thái `PENDING`, số tiền 299.000 VND, và mã `orderCode` duy nhất
- **And** hệ thống trả về URL thanh toán VNPAY Sandbox hợp lệ với `vnp_Amount=29900000`, `vnp_TxnRef=orderCode`, và mã băm `vnp_SecureHash` chuẩn HMAC-SHA512.

### Scenario [SCENARIO-SUB-06]: Successful IPN fulfills payment order
- **Given** một `PaymentOrder` ở trạng thái `PENDING`
- **When** VNPAY gửi request IPN với `vnp_ResponseCode="00"`, chữ ký hợp lệ và số tiền trùng khớp
- **Then** hệ thống phản hồi `{"RspCode":"00","Message":"Confirm Success"}`
- **And** trạng thái đơn hàng đổi sang `COMPLETED`
- **And** hệ thống phát sinh sự kiện `PaymentCompletedEvent` với `userId`, `planId`, `orderCode`.

### Scenario [SCENARIO-SUB-07]: Duplicate IPN does not re-process order
- **Given** một `PaymentOrder` đã ở trạng thái `COMPLETED`
- **When** VNPAY gửi lại request IPN giống hệt
- **Then** hệ thống phản hồi `{"RspCode":"02","Message":"Order already confirmed"}`
- **And** không phát sinh thêm sự kiện và không cập nhật lại trạng thái đơn hàng.

### Scenario [SCENARIO-SUB-08]: Failed payment IPN updates order to FAILED
- **Given** một `PaymentOrder` ở trạng thái `PENDING`
- **When** VNPAY gửi request IPN với `vnp_ResponseCode != "00"` (người dùng hủy giao dịch)
- **Then** hệ thống cập nhật `PaymentOrder` sang `FAILED`
- **And** phản hồi `{"RspCode":"00","Message":"Confirm Success"}` cho VNPAY.
