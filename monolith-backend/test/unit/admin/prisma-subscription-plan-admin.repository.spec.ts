import { ConflictException } from '@nestjs/common';
import { PrismaSubscriptionPlanAdminRepository } from '@app/admin/infrastructure/prisma-subscription-plan-admin.repository';
import { PrismaService } from '@app/database';

describe('PrismaSubscriptionPlanAdminRepository', () => {
  const plan = {
    id: 'plan-id',
    code: 'PRO',
    name: 'Pro',
    priceVnd: 299000,
    monthlyQuota: 300,
    isActive: true,
    revision: 4,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  it('rejects stale plan revisions without writing or auditing', async () => {
    const tx = {
      subscriptionPlan: {
        findUnique: jest.fn().mockResolvedValue({ ...plan, revision: 5 }),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      adminAuditEvent: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((run: (client: typeof tx) => unknown) => run(tx)),
    } as unknown as PrismaService;
    const repository = new PrismaSubscriptionPlanAdminRepository(prisma);
    await expect(
      repository.updatePlan({
        planId: plan.id,
        priceVnd: 349000,
        expectedRevision: 4,
        reason: 'Pricing update',
        adminId: 'admin-id',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.subscriptionPlan.updateMany).not.toHaveBeenCalled();
    expect(tx.adminAuditEvent.create).not.toHaveBeenCalled();
  });

  it('updates a plan and records before/after snapshots atomically', async () => {
    const updated = {
      ...plan,
      priceVnd: 349000,
      revision: 5,
      updatedAt: new Date('2026-02-01'),
    };
    const tx = {
      subscriptionPlan: {
        findUnique: jest.fn().mockResolvedValue(plan),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updated),
      },
      adminAuditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((run: (client: typeof tx) => unknown) => run(tx)),
    } as unknown as PrismaService;
    const repository = new PrismaSubscriptionPlanAdminRepository(prisma);
    await expect(
      repository.updatePlan({
        planId: plan.id,
        priceVnd: 349000,
        expectedRevision: 4,
        reason: 'Pricing update',
        adminId: 'admin-id',
      }),
    ).resolves.toEqual(updated);
    expect(tx.subscriptionPlan.updateMany).toHaveBeenCalledWith({
      where: { id: plan.id, revision: 4 },
      data: { priceVnd: 349000, revision: { increment: 1 } },
    });
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SUBSCRIPTION_PLAN_CHANGED',
          targetType: 'SUBSCRIPTION_PLAN',
          targetId: plan.id,
          actorId: 'admin-id',
          reason: 'Pricing update',
          before: {
            priceVnd: 299000,
            monthlyQuota: 300,
            isActive: true,
            revision: 4,
          },
          after: {
            priceVnd: 349000,
            monthlyQuota: 300,
            isActive: true,
            revision: 5,
          },
        }),
      }),
    );
  });

  it('does not increment revision or audit unchanged values', async () => {
    const tx = {
      subscriptionPlan: {
        findUnique: jest.fn().mockResolvedValue(plan),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      adminAuditEvent: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((run: (client: typeof tx) => unknown) => run(tx)),
    } as unknown as PrismaService;
    const repository = new PrismaSubscriptionPlanAdminRepository(prisma);
    await expect(
      repository.updatePlan({
        planId: plan.id,
        priceVnd: plan.priceVnd,
        expectedRevision: plan.revision,
        reason: 'Reviewed pricing',
        adminId: 'admin-id',
      }),
    ).resolves.toEqual(plan);
    expect(tx.subscriptionPlan.updateMany).not.toHaveBeenCalled();
    expect(tx.adminAuditEvent.create).not.toHaveBeenCalled();
  });
});
