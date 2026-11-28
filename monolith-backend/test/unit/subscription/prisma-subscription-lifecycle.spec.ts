import { PlanCode, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '@app/database';
import { PrismaSubscriptionRepository } from '@app/subscription/infrastructure/persistence/prisma-subscription.repository';

describe('PrismaSubscriptionRepository lifecycle transitions', () => {
  it('switches due subscriptions, expires paid plans, and renews Free atomically', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'downgrade-sub',
        currentPeriodEnd: new Date('2026-11-27T00:00:00Z'),
        nextPlanId: 'starter-id',
        plan: { code: PlanCode.PRO, monthlyQuota: 5000 },
      },
      {
        id: 'free-sub',
        currentPeriodEnd: new Date('2026-11-27T00:00:00Z'),
        nextPlanId: null,
        plan: { code: PlanCode.FREE, monthlyQuota: 100 },
      },
      {
        id: 'expire-sub',
        currentPeriodEnd: new Date('2026-11-27T00:00:00Z'),
        nextPlanId: null,
        plan: { code: PlanCode.PRO, monthlyQuota: 5000 },
      },
    ]);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const createUsage = jest.fn();
    const transaction = {
      subscription: { findMany, updateMany },
      subscriptionPlan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'starter-id',
          isActive: true,
          monthlyQuota: 1000,
        }),
      },
      subscriptionUsage: { create: createUsage },
    };
    const prisma = {
      $transaction: jest.fn(
        (work: (client: typeof transaction) => Promise<void>) =>
          work(transaction),
      ),
    } as unknown as PrismaService;
    const repository = new PrismaSubscriptionRepository(prisma);
    const now = new Date('2026-11-28T00:00:00Z');

    await repository.applyDueLifecycleTransitions(now);

    expect(updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ id: 'downgrade-sub' }),
        data: expect.objectContaining({
          planId: 'starter-id',
          nextPlanId: null,
          currentPeriodStart: now,
        }),
      }),
    );
    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ id: 'free-sub' }),
        data: expect.objectContaining({ currentPeriodStart: now }),
      }),
    );
    expect(updateMany).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({ id: 'expire-sub' }),
        data: { status: SubscriptionStatus.EXPIRED, nextPlanId: null },
      }),
    );
    expect(createUsage).toHaveBeenCalledTimes(2);
    expect(createUsage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ totalQuota: 1000 }),
      }),
    );
    expect(createUsage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ totalQuota: 100 }),
      }),
    );
  });

  it('does not create usage when a concurrent payment moved the cycle forward', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const transaction = {
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'free-sub',
            currentPeriodEnd: new Date('2026-11-27T00:00:00Z'),
            nextPlanId: null,
            plan: { code: PlanCode.FREE, monthlyQuota: 100 },
          },
        ]),
        updateMany,
      },
      subscriptionUsage: { create: jest.fn() },
      subscriptionPlan: { findUnique: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(
        (work: (client: typeof transaction) => Promise<void>) =>
          work(transaction),
      ),
    } as unknown as PrismaService;

    await new PrismaSubscriptionRepository(prisma).applyDueLifecycleTransitions(
      new Date('2026-11-28T00:00:00Z'),
    );

    expect(transaction.subscriptionUsage.create).not.toHaveBeenCalled();
  });
});
