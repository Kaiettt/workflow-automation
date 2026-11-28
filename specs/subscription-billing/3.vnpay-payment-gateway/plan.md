# Implementation Plan: Ticket 3 - VNPay Payment Gateway & Idempotent IPN Webhook

## Milestone
Hoàn thành module `libs/payment` kết nối VNPAY Sandbox: tạo đơn thanh toán, URL checkout, và xử lý IPN server-to-server bảo đảm idempotency.

## Vertical Slices
1. **Slice 1**: Schema `PaymentOrder` và tiện ích ký HMAC-SHA512 `VNPaySigner`.
2. **Slice 2**: Endpoint `POST /api/v1/billing/checkout` tạo đơn thanh toán và sinh URL.
3. **Slice 3**: Endpoint `GET /api/v1/payments/vnpay/ipn` xác thực và xử lý đơn hàng idempotent.
4. **Slice 4**: Endpoint `GET /api/v1/payments/vnpay/return` redirect về frontend display.
