import { PlanCode, SubscriptionStatus } from '@prisma/client';
import { SubscriptionLifecycleService } from '../../../libs/subscription/src/application/services/subscription-lifecycle.service';
import type {
  SubscriptionPlanRepository,
  SubscriptionRepository,
} from '../../../libs/subscription/src/domain/repositories';

describe('SubscriptionLifecycleService', () => {
  const freePlan = {
    id: 'free-id',
    code: PlanCode.FREE,
    name: 'Free',
    priceVnd: 0,
    monthlyQuota: 100,
    isActive: true,
  };
  const proPlan = {
    id: 'pro-id',
    code: PlanCode.PRO,
    name: 'Pro',
    priceVnd: 299000,
    monthlyQuota: 5000,
    isActive: true,
  };
  const subscription = {
    id: 'subscription-id',
    userId: 'user-id',
    planId: proPlan.id,
    plan: proPlan,
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date('2026-11-01T00:00:00Z'),
    currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
    nextPlanId: 'starter-id',
    autoRenew: true,
  };

  let subscriptions: jest.Mocked<SubscriptionRepository>;
  let plans: jest.Mocked<SubscriptionPlanRepository>;
  let service: SubscriptionLifecycleService;

  beforeEach(() => {
    subscriptions = {
      findByUserId: jest.fn().mockResolvedValue(subscription),
      create: jest.fn(),
      update: jest.fn(),
      getCurrentUsage: jest.fn(),
      createUsage: jest.fn(),
      incrementUsage: jest.fn(),
      reserveQuota: jest.fn(),
      applyPaidPlan: jest.fn(),
      applyDueLifecycleTransitions: jest.fn(),
      activateFreePlan: jest.fn(),
    };
    plans = {
      findByCode: jest.fn(),
      findById: jest.fn(),
      findAllActive: jest.fn(),
    };
    service = new SubscriptionLifecycleService(subscriptions, plans);
  });

  it('fulfills each paid order with a fresh cycle and full plan quota', async () => {
    plans.findById.mockResolvedValue(proPlan);

    await service.handlePaymentCompleted({
      userId: 'user-id',
      planId: proPlan.id,
      orderCode: 'ORDER-1',
    });

    expect(subscriptions.applyPaidPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        planId: proPlan.id,
        orderCode: 'ORDER-1',
        totalQuota: 5000,
      }),
    );
    const application = subscriptions.applyPaidPlan.mock.calls[0][0];
    expect(
      application.periodEnd.getTime() - application.periodStart.getTime(),
    ).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('schedules a lower priced active plan at the current cycle boundary', async () => {
    plans.findByCode.mockResolvedValue({
      ...proPlan,
      id: 'starter-id',
      code: PlanCode.STARTER,
      priceVnd: 99000,
    });

    await service.scheduleDowngrade('user-id', PlanCode.STARTER);

    expect(subscriptions.update).toHaveBeenCalledWith(subscription.id, {
      nextPlanId: 'starter-id',
      autoRenew: true,
    });
  });

  it('cancels renewal and clears any pending downgrade', async () => {
    await service.cancelRenewal('user-id');

    expect(subscriptions.update).toHaveBeenCalledWith(subscription.id, {
      autoRenew: false,
      nextPlanId: null,
    });
  });

  it('starts a new Free cycle for an expired subscription', async () => {
    subscriptions.findByUserId.mockResolvedValue({
      ...subscription,
      status: SubscriptionStatus.EXPIRED,
    });
    plans.findByCode.mockResolvedValue(freePlan);

    await service.switchToFree('user-id');

    expect(subscriptions.activateFreePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        planId: freePlan.id,
        totalQuota: 100,
      }),
    );
  });

  it('rejects switching to Free before the current subscription expires', async () => {
    await expect(service.switchToFree('user-id')).rejects.toThrow(
      'Only an expired subscription can switch to Free',
    );
    expect(subscriptions.activateFreePlan).not.toHaveBeenCalled();
  });

  it('does not allow cancelling the Free plan renewal', async () => {
    subscriptions.findByUserId.mockResolvedValue({
      ...subscription,
      plan: freePlan,
      planId: freePlan.id,
    });

    await expect(service.cancelRenewal('user-id')).rejects.toThrow(
      'Free plan renewal cannot be cancelled',
    );
    expect(subscriptions.update).not.toHaveBeenCalled();
  });
});
