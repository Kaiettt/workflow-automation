import { Test, TestingModule } from '@nestjs/testing';
import { PlanCode, SubscriptionStatus } from '@prisma/client';
import { SubscriptionProvisioningService } from '@app/subscription/application/services/subscription-provisioning.service';
import {
  SUBSCRIPTION_PLAN_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
  SubscriptionPlanRepository,
  SubscriptionRepository,
} from '@app/subscription/domain/repositories';

describe('SubscriptionProvisioningService', () => {
  let service: SubscriptionProvisioningService;
  let subscriptionRepo: jest.Mocked<SubscriptionRepository>;
  let planRepo: jest.Mocked<SubscriptionPlanRepository>;

  const mockPlan = {
    id: 'plan-free-id',
    code: PlanCode.FREE,
    name: 'Free',
    priceVnd: 0,
    monthlyQuota: 100,
    isActive: true,
  };

  beforeEach(async () => {
    subscriptionRepo = {
      findByUserId: jest.fn(),
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

    planRepo = {
      findByCode: jest.fn(),
      findById: jest.fn(),
      findAllActive: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionProvisioningService,
        {
          provide: SUBSCRIPTION_REPOSITORY,
          useValue: subscriptionRepo,
        },
        {
          provide: SUBSCRIPTION_PLAN_REPOSITORY,
          useValue: planRepo,
        },
      ],
    }).compile();

    service = module.get<SubscriptionProvisioningService>(
      SubscriptionProvisioningService,
    );
  });

  it('should allocate FREE subscription with 100 quota for a new user if no active subscription exists', async () => {
    const userId = 'user-123';
    subscriptionRepo.findByUserId.mockResolvedValue(null);
    planRepo.findByCode.mockResolvedValue(mockPlan);

    const createdSub = {
      id: 'sub-123',
      userId,
      planId: mockPlan.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: true,
      plan: mockPlan,
    };
    subscriptionRepo.create.mockResolvedValue(createdSub);

    const result = await service.allocateDefaultFreeSubscription(userId);

    expect(subscriptionRepo.findByUserId).toHaveBeenCalledWith(userId);
    expect(planRepo.findByCode).toHaveBeenCalledWith(PlanCode.FREE);
    expect(subscriptionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        planId: mockPlan.id,
        status: SubscriptionStatus.ACTIVE,
      }),
      expect.objectContaining({
        totalQuota: 100,
      }),
    );
    expect(result).toEqual(createdSub);
  });

  it('should return existing subscription if user already has an active subscription', async () => {
    const userId = 'user-123';
    const existingSub = {
      id: 'sub-existing',
      userId,
      planId: mockPlan.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      autoRenew: true,
    };
    subscriptionRepo.findByUserId.mockResolvedValue(existingSub);

    const result = await service.allocateDefaultFreeSubscription(userId);

    expect(subscriptionRepo.create).not.toHaveBeenCalled();
    expect(result).toEqual(existingSub);
  });
});
