import { PrismaClient } from '@prisma/client';
import { seedMissingFreeSubscriptions } from '../../../prisma/seed-missing-free-subscriptions';

describe('seedMissingFreeSubscriptions', () => {
  const now = new Date('2026-11-28T10:00:00.000Z');
  let prisma: {
    subscriptionPlan: { findUnique: jest.Mock };
    user: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let transaction: {
    subscription: { create: jest.Mock };
    subscriptionUsage: { create: jest.Mock };
  };

  beforeEach(() => {
    transaction = {
      subscription: { create: jest.fn().mockResolvedValue({ id: 'sub-id' }) },
      subscriptionUsage: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      subscriptionPlan: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'free-plan-id', monthlyQuota: 100 }),
      },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'client-id' }, { id: 'admin-id' }]),
      },
      $transaction: jest.fn(
        (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
  });

  it('creates a Free subscription and quota period for every user without one', async () => {
    await expect(
      seedMissingFreeSubscriptions(prisma as unknown as PrismaClient, now),
    ).resolves.toBe(2);

    expect(prisma.subscriptionPlan.findUnique).toHaveBeenCalledWith({
      where: { code: 'FREE' },
      select: { id: true, monthlyQuota: true },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { subscription: null },
      select: { id: true },
    });
    expect(transaction.subscription.create).toHaveBeenCalledTimes(2);
    expect(transaction.subscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'client-id',
        planId: 'free-plan-id',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: new Date('2026-12-28T10:00:00.000Z'),
        autoRenew: true,
      }),
      select: { id: true },
    });
    expect(transaction.subscriptionUsage.create).toHaveBeenCalledWith({
      data: {
        subscriptionId: 'sub-id',
        periodStart: now,
        periodEnd: new Date('2026-12-28T10:00:00.000Z'),
        totalQuota: 100,
        usedQuota: 0,
        manualUsage: 0,
        webhookUsage: 0,
        scheduleUsage: 0,
      },
    });
  });

  it('does nothing when there are no users missing subscriptions', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await expect(
      seedMissingFreeSubscriptions(prisma as unknown as PrismaClient, now),
    ).resolves.toBe(0);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not create duplicate subscriptions when the seed runs again', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: 'legacy-user-id' }])
      .mockResolvedValueOnce([]);

    await expect(
      seedMissingFreeSubscriptions(prisma as unknown as PrismaClient, now),
    ).resolves.toBe(1);
    await expect(
      seedMissingFreeSubscriptions(prisma as unknown as PrismaClient, now),
    ).resolves.toBe(0);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.subscriptionUsage.create).toHaveBeenCalledTimes(1);
  });

  it('fails clearly when the Free plan is missing', async () => {
    prisma.subscriptionPlan.findUnique.mockResolvedValue(null);

    await expect(
      seedMissingFreeSubscriptions(prisma as unknown as PrismaClient, now),
    ).rejects.toThrow('Free subscription plan must be seeded first');

    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
