import { Injectable, Logger } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '@app/database';
import {
  SubscriptionModel,
  SubscriptionUsageModel,
} from '../../domain/entities';
import {
  QuotaReservationResult,
  SubscriptionRepository,
} from '../../domain/repositories';

@Injectable()
export class PrismaSubscriptionRepository implements SubscriptionRepository {
  private readonly logger = new Logger(PrismaSubscriptionRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<SubscriptionModel | null> {
    return this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });
  }

  async create(
    data: Omit<SubscriptionModel, 'id' | 'createdAt' | 'updatedAt'>,
    usage: Omit<
      SubscriptionUsageModel,
      'id' | 'subscriptionId' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<SubscriptionModel> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.subscription.create({
        data: {
          userId: data.userId,
          planId: data.planId,
          status: data.status,
          currentPeriodStart: data.currentPeriodStart,
          currentPeriodEnd: data.currentPeriodEnd,
          nextPlanId: data.nextPlanId,
          autoRenew: data.autoRenew,
        },
        include: { plan: true },
      });

      await tx.subscriptionUsage.create({
        data: {
          subscriptionId: created.id,
          periodStart: usage.periodStart,
          periodEnd: usage.periodEnd,
          totalQuota: usage.totalQuota,
          usedQuota: usage.usedQuota,
          manualUsage: usage.manualUsage,
          webhookUsage: usage.webhookUsage,
          scheduleUsage: usage.scheduleUsage,
        },
      });

      return created;
    });
  }

  async update(
    id: string,
    data: Partial<
      Omit<
        SubscriptionModel,
        'id' | 'userId' | 'createdAt' | 'updatedAt' | 'plan'
      >
    >,
  ): Promise<SubscriptionModel> {
    return this.prisma.subscription.update({
      where: { id },
      data: {
        planId: data.planId,
        status: data.status,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        nextPlanId: data.nextPlanId,
        autoRenew: data.autoRenew,
      },
      include: { plan: true },
    });
  }

  async getCurrentUsage(
    subscriptionId: string,
  ): Promise<SubscriptionUsageModel | null> {
    const now = new Date();
    return this.prisma.subscriptionUsage.findFirst({
      where: {
        subscriptionId,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUsage(
    usage: Omit<SubscriptionUsageModel, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SubscriptionUsageModel> {
    return this.prisma.subscriptionUsage.create({
      data: usage,
    });
  }

  async incrementUsage(
    usageId: string,
    triggerType: 'MANUAL' | 'WEBHOOK' | 'SCHEDULE',
  ): Promise<SubscriptionUsageModel> {
    const updateData: Record<string, { increment: number }> = {
      usedQuota: { increment: 1 },
    };
    if (triggerType === 'MANUAL') {
      updateData.manualUsage = { increment: 1 };
    } else if (triggerType === 'WEBHOOK') {
      updateData.webhookUsage = { increment: 1 };
    } else if (triggerType === 'SCHEDULE') {
      updateData.scheduleUsage = { increment: 1 };
    }

    return this.prisma.subscriptionUsage.update({
      where: { id: usageId },
      data: updateData,
    });
  }

  async reserveQuota(
    userId: string,
    triggerType: 'MANUAL' | 'WEBHOOK' | 'SCHEDULE',
  ): Promise<QuotaReservationResult> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (subscription?.status === SubscriptionStatus.EXPIRED) {
      this.logger.warn(
        JSON.stringify({
          event: 'subscription.quota.reservation.denied',
          reason: 'subscription_expired',
          subscriptionFound: true,
          subscriptionStatus: subscription.status,
          triggerType,
        }),
      );
      return 'SUBSCRIPTION_EXPIRED';
    }
    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      this.logger.warn(
        JSON.stringify({
          event: 'subscription.quota.reservation.denied',
          reason: 'no_active_subscription',
          subscriptionFound: Boolean(subscription),
          subscriptionStatus: subscription?.status ?? 'MISSING',
          triggerType,
        }),
      );
      return 'NO_ACTIVE_SUBSCRIPTION';
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const usages = await tx.$queryRaw<
        Array<{
          id: string;
          total_quota: number;
          used_quota: number;
        }>
      >`
        SELECT id, total_quota, used_quota
        FROM subscription_usages
        WHERE subscription_id = ${subscription.id}::uuid
          AND period_start <= ${now}
          AND period_end >= ${now}
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      `;

      if (usages.length === 0) {
        return 'NO_ACTIVE_PERIOD';
      }

      const usage = usages[0];
      if (usage.used_quota >= usage.total_quota) {
        return 'QUOTA_EXCEEDED';
      }

      const usageField =
        triggerType === 'MANUAL'
          ? 'manual_usage'
          : triggerType === 'WEBHOOK'
            ? 'webhook_usage'
            : 'schedule_usage';

      await tx.$executeRaw`
        UPDATE subscription_usages
        SET used_quota = used_quota + 1,
            ${Prisma.raw(usageField)} = ${Prisma.raw(usageField)} + 1,
            updated_at = NOW()
        WHERE id = ${usage.id}::uuid
      `;

      return 'RESERVED';
    });

    if (result === 'NO_ACTIVE_PERIOD') {
      this.logger.warn(
        JSON.stringify({
          event: 'subscription.quota.reservation.denied',
          reason: 'no_active_period',
          subscriptionFound: true,
          subscriptionStatus: subscription.status,
          triggerType,
        }),
      );
    } else if (result === 'QUOTA_EXCEEDED') {
      this.logger.warn(
        JSON.stringify({
          event: 'subscription.quota.reservation.denied',
          reason: 'quota_exceeded',
          subscriptionStatus: subscription.status,
          triggerType,
        }),
      );
    }

    return result;
  }

  async applyPaidPlan(input: {
    userId: string;
    planId: string;
    orderCode: string;
    periodStart: Date;
    periodEnd: Date;
    totalQuota: number;
  }): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const alreadyApplied =
          await tx.subscriptionPaymentFulfillment.findUnique({
            where: { orderCode: input.orderCode },
          });
        if (alreadyApplied) return;

        const subscription = await tx.subscription.findUnique({
          where: { userId: input.userId },
        });
        if (!subscription) {
          throw new Error(`Subscription not found for user ${input.userId}`);
        }

        await tx.subscriptionPaymentFulfillment.create({
          data: { orderCode: input.orderCode },
        });
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            planId: input.planId,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: input.periodStart,
            currentPeriodEnd: input.periodEnd,
            nextPlanId: null,
            autoRenew: true,
          },
        });
        await tx.subscriptionUsage.create({
          data: {
            subscriptionId: subscription.id,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            totalQuota: input.totalQuota,
            usedQuota: 0,
            manualUsage: 0,
            webhookUsage: 0,
            scheduleUsage: 0,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return;
      }
      throw error;
    }
  }

  async applyDueLifecycleTransitions(now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const due = await tx.subscription.findMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: { lt: now },
        },
        include: { plan: true },
      });

      for (const subscription of due) {
        if (subscription.nextPlanId) {
          const nextPlan = await tx.subscriptionPlan.findUnique({
            where: { id: subscription.nextPlanId },
          });
          if (nextPlan?.isActive) {
            const periodEnd = new Date(
              now.getTime() + 30 * 24 * 60 * 60 * 1000,
            );
            const transitioned = await tx.subscription.updateMany({
              where: {
                id: subscription.id,
                status: SubscriptionStatus.ACTIVE,
                currentPeriodEnd: subscription.currentPeriodEnd,
              },
              data: {
                planId: nextPlan.id,
                nextPlanId: null,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
              },
            });
            if (transitioned.count === 0) continue;
            await tx.subscriptionUsage.create({
              data: {
                subscriptionId: subscription.id,
                periodStart: now,
                periodEnd,
                totalQuota: nextPlan.monthlyQuota,
              },
            });
            continue;
          }
        }

        if (subscription.plan.code === 'FREE') {
          const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          const transitioned = await tx.subscription.updateMany({
            where: {
              id: subscription.id,
              status: SubscriptionStatus.ACTIVE,
              currentPeriodEnd: subscription.currentPeriodEnd,
            },
            data: { currentPeriodStart: now, currentPeriodEnd: periodEnd },
          });
          if (transitioned.count === 0) continue;
          await tx.subscriptionUsage.create({
            data: {
              subscriptionId: subscription.id,
              periodStart: now,
              periodEnd,
              totalQuota: subscription.plan.monthlyQuota,
            },
          });
          continue;
        }

        await tx.subscription.updateMany({
          where: {
            id: subscription.id,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: subscription.currentPeriodEnd,
          },
          data: { status: SubscriptionStatus.EXPIRED, nextPlanId: null },
        });
      }
    });
  }

  async activateFreePlan(input: {
    userId: string;
    planId: string;
    periodStart: Date;
    periodEnd: Date;
    totalQuota: number;
  }): Promise<SubscriptionModel> {
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.findUnique({
        where: { userId: input.userId },
      });
      if (!subscription || subscription.status !== SubscriptionStatus.EXPIRED) {
        throw new Error('Only an expired subscription can switch to Free');
      }

      const updated = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: input.planId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: input.periodStart,
          currentPeriodEnd: input.periodEnd,
          nextPlanId: null,
          autoRenew: true,
        },
        include: { plan: true },
      });
      await tx.subscriptionUsage.create({
        data: {
          subscriptionId: subscription.id,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          totalQuota: input.totalQuota,
        },
      });
      return updated;
    });
  }
}
