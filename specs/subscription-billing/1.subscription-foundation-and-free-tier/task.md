# Task & Evidence: Ticket 1 - Subscription Foundation & Free Tier

- [x] **Task 1.1**: Định nghĩa schema Prisma (`SubscriptionPlan`, `Subscription`, `SubscriptionUsage`).
  - *Verify*: `npx prisma validate` & `npx prisma db push` -> Passed (Generated Prisma Client v5.22.0)
- [x] **Task 1.2**: Tạo script seed 4 gói cước (`FREE`, `STARTER`, `PRO`, `BUSINESS`).
  - *Verify*: `npx ts-node prisma/seed-subscription-plans.ts` -> Created 4 plans successfully
- [x] **Task 1.3**: Tạo module `libs/subscription` và triển khai `PrismaSubscriptionRepository`.
  - *Test Red/Green*: Unit test `SubscriptionProvisioningService.spec.ts` -> Passed (2 tests)
- [x] **Task 1.4**: Cắm seam vào `RegisterHandler` trong `libs/auth`.
  - *Traceable Scenario*: `[SCENARIO-SUB-01]`
  - *Test Red/Green*: Unit test `register.command.spec.ts` kiểm tra cấp gói `FREE` cho role `CLIENT` -> Passed (1 test)
