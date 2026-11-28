import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@app/database';
import { QuotaEnforcer } from '@app/subscription/application/services/quota-enforcer';
import { QuotaExceededException } from '@app/subscription/domain/exceptions/quota-exceeded.exception';
import { SubscriptionExpiredException } from '@app/subscription/domain/exceptions/subscription-expired.exception';
import { PrismaSubscriptionRepository } from '@app/subscription/infrastructure/persistence/prisma-subscription.repository';
import {
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '@app/subscription/domain/repositories';

describe('QuotaEnforcer (Ticket 2 - Task 2.1)', () => {
  let enforcer: QuotaEnforcer;
  let subscriptionRepo: jest.Mocked<SubscriptionRepository>;

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
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotaEnforcer,
        {
          provide: SUBSCRIPTION_REPOSITORY,
          useValue: subscriptionRepo,
        },
      ],
    }).compile();

    enforcer = module.get<QuotaEnforcer>(QuotaEnforcer);
  });

  it('should successfully reserve quota when used_quota < total_quota for MANUAL trigger', async () => {
    const userId = 'user-test-id';
    subscriptionRepo.reserveQuota.mockResolvedValue('RESERVED');

    await expect(
      enforcer.reserveExecutionQuota(userId, 'MANUAL'),
    ).resolves.toBeUndefined();

    expect(subscriptionRepo.reserveQuota).toHaveBeenCalledWith(
      userId,
      'MANUAL',
    );
  });

  it('should throw QuotaExceededException when used_quota >= total_quota', async () => {
    const userId = 'user-test-id';
    subscriptionRepo.reserveQuota.mockResolvedValue('QUOTA_EXCEEDED');

    await expect(
      enforcer.reserveExecutionQuota(userId, 'WEBHOOK'),
    ).rejects.toThrow(QuotaExceededException);

    expect(subscriptionRepo.reserveQuota).toHaveBeenCalledWith(
      userId,
      'WEBHOOK',
    );
  });

  it('should throw QuotaExceededException when user has no active subscription', async () => {
    const userId = 'user-without-sub';
    subscriptionRepo.reserveQuota.mockResolvedValue('NO_ACTIVE_SUBSCRIPTION');

    await expect(
      enforcer.reserveExecutionQuota(userId, 'MANUAL'),
    ).rejects.toThrow(QuotaExceededException);
  });

  it('should identify an expired subscription distinctly', async () => {
    subscriptionRepo.reserveQuota.mockResolvedValue('SUBSCRIPTION_EXPIRED');

    await expect(
      enforcer.reserveExecutionQuota('user-expired', 'MANUAL'),
    ).rejects.toThrow(SubscriptionExpiredException);
  });

  it('should throw QuotaExceededException when there is no active quota period', async () => {
    subscriptionRepo.reserveQuota.mockResolvedValue('NO_ACTIVE_PERIOD');

    await expect(
      enforcer.reserveExecutionQuota('user-test-id', 'SCHEDULE'),
    ).rejects.toThrow(QuotaExceededException);
  });
});

describe('PrismaSubscriptionRepository quota reservation', () => {
  let prisma: jest.Mocked<PrismaService>;
  let transaction: { $queryRaw: jest.Mock; $executeRaw: jest.Mock };
  let repository: PrismaSubscriptionRepository;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    transaction = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };
    prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'subscription-id',
          status: 'ACTIVE',
        }),
      },
      $transaction: jest.fn((callback) => callback(transaction)),
    } as any;
    repository = new PrismaSubscriptionRepository(prisma);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('should reserve quota inside a transaction when capacity remains', async () => {
    transaction.$queryRaw.mockResolvedValue([
      { id: 'usage-id', total_quota: 100, used_quota: 10 },
    ]);

    await expect(repository.reserveQuota('user-id', 'MANUAL')).resolves.toBe(
      'RESERVED',
    );

    expect(transaction.$queryRaw).toHaveBeenCalled();
    expect(transaction.$executeRaw).toHaveBeenCalled();
  });

  it('should return QUOTA_EXCEEDED without incrementing exhausted usage', async () => {
    transaction.$queryRaw.mockResolvedValue([
      { id: 'usage-id', total_quota: 100, used_quota: 100 },
    ]);

    await expect(repository.reserveQuota('user-id', 'WEBHOOK')).resolves.toBe(
      'QUOTA_EXCEEDED',
    );

    expect(transaction.$executeRaw).not.toHaveBeenCalled();
  });

  it('should return NO_ACTIVE_PERIOD when the subscription has no current usage', async () => {
    transaction.$queryRaw.mockResolvedValue([]);

    await expect(repository.reserveQuota('user-id', 'SCHEDULE')).resolves.toBe(
      'NO_ACTIVE_PERIOD',
    );

    expect(transaction.$executeRaw).not.toHaveBeenCalled();
  });

  it('should return NO_ACTIVE_SUBSCRIPTION without opening a transaction', async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(repository.reserveQuota('user-id', 'MANUAL')).resolves.toBe(
      'NO_ACTIVE_SUBSCRIPTION',
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    const log = warnSpy.mock.calls
      .map(
        ([message]) => JSON.parse(String(message)) as Record<string, unknown>,
      )
      .find(
        (entry) => entry['event'] === 'subscription.quota.reservation.denied',
      );
    expect(log).toEqual(
      expect.objectContaining({
        reason: 'no_active_subscription',
        subscriptionFound: false,
        subscriptionStatus: 'MISSING',
        triggerType: 'MANUAL',
      }),
    );
    expect(log).not.toHaveProperty('userId');
  });

  it('should log the existing subscription status when it is not active', async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'subscription-id',
      status: 'CANCELLED',
    } as never);

    await expect(repository.reserveQuota('user-id', 'WEBHOOK')).resolves.toBe(
      'NO_ACTIVE_SUBSCRIPTION',
    );

    const log = warnSpy.mock.calls
      .map(
        ([message]) => JSON.parse(String(message)) as Record<string, unknown>,
      )
      .find(
        (entry) => entry['event'] === 'subscription.quota.reservation.denied',
      );
    expect(log).toEqual(
      expect.objectContaining({
        reason: 'no_active_subscription',
        subscriptionFound: true,
        subscriptionStatus: 'CANCELLED',
        triggerType: 'WEBHOOK',
      }),
    );
  });

  it('should distinguish an expired subscription before quota reservation', async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'subscription-id',
      status: 'EXPIRED',
    });

    await expect(repository.reserveQuota('user-id', 'MANUAL')).resolves.toBe(
      'SUBSCRIPTION_EXPIRED',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
