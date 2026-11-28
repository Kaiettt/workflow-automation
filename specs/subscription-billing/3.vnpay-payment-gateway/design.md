# Technical Design: Ticket 3 - VNPay Payment Gateway & Idempotent IPN Webhook

## 1. Schema Model
Bổ sung vào `prisma/schema.prisma`:
- `enum PaymentOrderStatus { PENDING, COMPLETED, FAILED }`
- `enum PaymentProvider { VNPAY }`
- `model PaymentOrder`:
  - `id`: UUID
  - `orderCode`: String (unique) - ánh xạ với `vnp_TxnRef`
  - `userId`: UUID (foreign key `User`)
  - `planId`: UUID (foreign key `SubscriptionPlan`)
  - `amountVnd`: Int (giá gốc snapshot tại thời điểm tạo đơn)
  - `status`: PaymentOrderStatus (mặc định `PENDING`)
  - `provider`: PaymentProvider (mặc định `VNPAY`)
  - `transactionNo`, `bankCode`, `responseCode`: String (lưu từ callback)
  - `payDate`: DateTime

## 2. VNPay Signer & Parameters Utility
- Sắp xếp thứ tự các tham số theo bảng chữ cái US-ASCII (`vnp_Amount`, `vnp_Command`, `vnp_CreateDate`, `vnp_CurrCode`, `vnp_IpAddr`, `vnp_Locale`, `vnp_OrderInfo`, `vnp_OrderType`, `vnp_ReturnUrl`, `vnp_TmnCode`, `vnp_TxnRef`, `vnp_Version`).
- Mã hóa URL-encoded key và value (`encodeURIComponent`).
- Tính toán mã băm HMAC-SHA512 bằng `crypto.createHmac('sha512', hashSecret)`.
- Chú ý: `vnp_Amount = amountVnd * 100`.

## 3. IPN Webhook Validation Flow
Tại endpoint `GET /api/v1/payments/vnpay/ipn`:
1. Tách `vnp_SecureHash` và `vnp_SecureHashType` ra khỏi query params.
2. Kiểm tra chữ ký: Nếu không khớp, trả về `{"RspCode":"97","Message":"Invalid Checksum"}` (HTTP 200).
3. Tra cứu `PaymentOrder` theo `orderCode = vnp_TxnRef`: Nếu không tìm thấy, trả về `{"RspCode":"01","Message":"Order not Found"}`.
4. Kiểm tra trạng thái hiện tại: Nếu `status === COMPLETED` hoặc `status === FAILED`, trả về `{"RspCode":"02","Message":"Order already confirmed"}`.
5. Kiểm tra số tiền: So sánh `order.amountVnd * 100 === Number(vnp_Amount)`. Nếu sai lệch, trả về `{"RspCode":"04","Message":"Invalid Amount"}`.
6. Cập nhật trạng thái:
   - Nếu `vnp_ResponseCode === "00"`: cập nhật `status = COMPLETED`, lưu `transactionNo`, `payDate`, phát `PaymentCompletedEvent`.
   - Nếu `vnp_ResponseCode !== "00"`: cập nhật `status = FAILED`.
7. Trả về `{"RspCode":"00","Message":"Confirm Success"}`.
