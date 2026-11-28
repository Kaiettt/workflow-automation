import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SUBSCRIPTION_REPOSITORY } from '../../domain/repositories';
import type { SubscriptionRepository } from '../../domain/repositories';
import {
  QuotaReservationPort,
  QuotaTriggerType,
} from '../ports/quota-reservation.port';
import { QuotaExceededException } from '../../domain/exceptions/quota-exceeded.exception';
import { SubscriptionExpiredException } from '../../domain/exceptions/subscription-expired.exception';

@Injectable()
export class QuotaEnforcer implements QuotaReservationPort {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepo: SubscriptionRepository,
  ) {}

  async reserveExecutionQuota(
    userId: string,
    triggerType: QuotaTriggerType,
  ): Promise<void> {
    const result = await this.subscriptionRepo.reserveQuota(
      userId,
      triggerType,
    );

    if (result === 'RESERVED') {
      return;
    }
    if (result === 'SUBSCRIPTION_EXPIRED') {
      throw new SubscriptionExpiredException();
    }

    const messages = {
      NO_ACTIVE_SUBSCRIPTION:
        'No active subscription found. Please activate or renew your subscription.',
      NO_ACTIVE_PERIOD: 'No active quota period found for your subscription.',
      QUOTA_EXCEEDED:
        'Monthly execution quota exceeded. Please upgrade your plan.',
    } as const;

    throw new QuotaExceededException(messages[result]);
  }
}
