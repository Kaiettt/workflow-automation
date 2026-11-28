import { SubscriptionStatus } from '@prisma/client';
import { GetCurrentSubscriptionHandler } from '../../../libs/subscription/src/application/queries/get-current-subscription.query';
import type { SubscriptionRepository } from '../../../libs/subscription/src/domain/repositories';

describe('GetCurrentSubscriptionHandler', () => {
  const plan = {
    id: 'plan-1',
    code: 'PRO',
    name: 'Pro',
    priceVnd: 299000,
    monthlyQuota: 1000,
    isActive: true,
  };
  const subscription = {
    id: 'sub-1',
    userId: 'user-1',
    planId: plan.id,
    plan,
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date('2026-11-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-12-01T00:00:00.000Z'),
    nextPlanId: null,
    autoRenew: true,
  };
  let repository: jest.Mocked<SubscriptionRepository>;

  beforeEach(() => {
    repository = {
      findByUserId: jest.fn().mockResolvedValue(subscription),
      create: jest.fn(),
      update: jest.fn(),
      getCurrentUsage: jest.fn().mockResolvedValue({
        id: 'usage-1',
        subscriptionId: 'sub-1',
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        totalQuota: 1000,
        usedQuota: 245,
        manualUsage: 100,
        webhookUsage: 90,
        scheduleUsage: 55,
      }),
      createUsage: jest.fn(),
      incrementUsage: jest.fn(),
      reserveQuota: jest.fn(),
      applyPaidPlan: jest.fn(),
      applyDueLifecycleTransitions: jest.fn(),
      activateFreePlan: jest.fn(),
    };
  });

  it('returns a safe subscription and current usage view for the requested user', async () => {
    const handler = new GetCurrentSubscriptionHandler(repository);
    const result = await handler.execute({ userId: 'user-1' });
    expect(repository.findByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toMatchObject({
      id: 'sub-1',
      plan: { code: 'PRO', name: 'Pro' },
      usage: { totalQuota: 1000, usedQuota: 245, manualUsage: 100 },
    });
    expect(result).not.toHaveProperty('userId');
  });

  it('returns null if the account has no subscription', async () => {
    repository.findByUserId.mockResolvedValue(null);
    const handler = new GetCurrentSubscriptionHandler(repository);
    await expect(handler.execute({ userId: 'user-1' })).resolves.toBeNull();
    expect(repository.getCurrentUsage).not.toHaveBeenCalled();
  });
});
