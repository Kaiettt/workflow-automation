# Technical Design: Ticket 1 - Subscription Foundation & Free Tier

## 1. Schema Prisma
Bổ sung vào `prisma/schema.prisma`:
- `enum PlanCode { FREE, STARTER, PRO, BUSINESS }`
- `enum SubscriptionStatus { ACTIVE, EXPIRED, CANCELLED }`
- `model SubscriptionPlan`: Lưu danh mục 4 gói ban đầu.
- `model Subscription`: 1-1 với `User` (cho Client), lưu trạng thái và chu kỳ `[currentPeriodStart, currentPeriodEnd]`.
- `model SubscriptionUsage`: 1-N với `Subscription`, lưu hạn mức và lượng dùng thực tế.

## 2. Seed Data
Tạo seed script cho 4 gói:
- `FREE`: 0 VND, quota 100.
- `STARTER`: 99,000 VND, quota 1,000.
- `PRO`: 299,000 VND, quota 5,000.
- `BUSINESS`: 799,000 VND, quota 20,000.

## 3. NestJS Module & Seam
- Thư viện mới: `monolith-backend/libs/subscription`.
- Port: `SubscriptionProvisioningPort` với phương thức `allocateDefaultFreeSubscription(userId: string): Promise<Subscription>`.
- Điểm cắm (Seam): `RegisterHandler` trong `monolith-backend/libs/auth/src/application/commands/register.command.ts`.
  - Sau khi `this.userRepository.create(user)` thành công:
  - Nếu `user.role === UserRole.CLIENT`, gọi `this.subscriptionProvisioning.allocateDefaultFreeSubscription(user.id)`.
