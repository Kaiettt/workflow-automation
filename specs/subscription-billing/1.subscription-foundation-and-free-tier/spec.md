# Ticket 1: Subscription Foundation & Free Tier Allocation

## 1. Overview
Thiết lập nền tảng lưu trữ gói cước và đăng ký cho hệ thống FlowPilot. Tự động cấp gói `FREE` (hạn mức 100 quota/tháng) cho mọi tài khoản mới đăng ký với vai trò `CLIENT`.

## 2. Requirements & BDD Scenarios

### Scenario [SCENARIO-SUB-01]: Auto-assign Free plan upon registration
- **Given** một người dùng mới đăng ký với vai trò `CLIENT` và hoàn thành xác thực OTP
- **When** transaction tạo tài khoản người dùng hoàn tất
- **Then** một bản ghi `Subscription` được tạo với gói `FREE` và trạng thái `ACTIVE`
- **And** một bản ghi `SubscriptionUsage` được khởi tạo với `totalQuota = 100`, `usedQuota = 0`, chu kỳ 30 ngày bắt đầu từ thời điểm đăng ký.

### Scenario [SCENARIO-SUB-01-ADMIN]: Admin registration does not require subscription
- **Given** một tài khoản mới được tạo với vai trò `ADMIN`
- **When** transaction tạo tài khoản hoàn tất
- **Then** hệ thống không tạo bản ghi subscription cho tài khoản này.
