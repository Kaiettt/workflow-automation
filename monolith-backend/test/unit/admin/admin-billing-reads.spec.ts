import { PrismaAdminRead } from '@app/admin/infrastructure/prisma-admin-read';
import { PrismaService } from '@app/database';

describe('PrismaAdminRead billing queries', () => {
  it('returns subscriptions matching email, status, and plan with only billing projection fields', async () => {
    const subscriptionFindMany = jest.fn().mockResolvedValue([]);
    const subscriptionCount = jest.fn().mockResolvedValue(0);
    const prisma = {
      subscription: {
        findMany: subscriptionFindMany,
        count: subscriptionCount,
      },
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    } as unknown as PrismaService;
    const reads = new PrismaAdminRead(prisma);

    await reads.billingSubscriptions({
      page: 2,
      pageSize: 10,
      q: 'member@example.test',
      status: 'ACTIVE',
      planId: 'plan-id',
    });

    expect(subscriptionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
          planId: 'plan-id',
          user: {
            email: { contains: 'member@example.test', mode: 'insensitive' },
          },
        },
        select: expect.objectContaining({
          user: expect.any(Object),
          plan: expect.any(Object),
          usages: expect.any(Object),
        }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it('returns completed revenue grouped by the plan recorded on each order', async () => {
    const groupBy = jest
      .fn()
      .mockResolvedValue([
        { planId: 'plan-id', _count: { _all: 2 }, _sum: { amountVnd: 648000 } },
      ]);
    const findPlans = jest
      .fn()
      .mockResolvedValue([{ id: 'plan-id', code: 'PRO', name: 'Pro' }]);
    const prisma = {
      paymentOrder: { groupBy },
      subscriptionPlan: { findMany: findPlans },
    } as unknown as PrismaService;
    const reads = new PrismaAdminRead(prisma);
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-02-01T00:00:00.000Z');

    await expect(reads.billingRevenue({ from, to })).resolves.toEqual([
      {
        planId: 'plan-id',
        planCode: 'PRO',
        planName: 'Pro',
        orderCount: 2,
        revenueVnd: 648000,
      },
    ]);
    expect(groupBy).toHaveBeenCalledWith({
      by: ['planId'],
      where: { status: 'COMPLETED', payDate: { gte: from, lt: to } },
      _sum: { amountVnd: true },
      _count: { _all: true },
    });
  });

  it('excludes the provider response payload from payment order results', async () => {
    const paymentFindMany = jest.fn().mockResolvedValue([]);
    const paymentCount = jest.fn().mockResolvedValue(0);
    const prisma = {
      paymentOrder: { findMany: paymentFindMany, count: paymentCount },
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    } as unknown as PrismaService;
    const reads = new PrismaAdminRead(prisma);

    await reads.billingPayments({ page: 1, pageSize: 20, status: 'FAILED' });

    expect(paymentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'FAILED' },
        select: expect.not.objectContaining({ responseCode: true }),
      }),
    );
  });
});
