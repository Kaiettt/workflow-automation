# Implementation Plan: Ticket 1 - Subscription Foundation & Free Tier

## Milestone
Hoàn thành schema, seed dữ liệu 4 gói cước, dựng thư viện `libs/subscription`, và kết nối hook tự động cấp gói Free khi Client đăng ký.

## Vertical Slices
1. **Slice 1**: Prisma schema migration & plan seeds.
2. **Slice 2**: Domain models, repository và service cấp gói Free trong `libs/subscription`.
3. **Slice 3**: Tích hợp hook trong `RegisterHandler` và kiểm thử unit/integration.
