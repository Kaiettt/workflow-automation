import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/database';
import { SubscriptionPlanAdminPort } from '../application/update-subscription-plan.command';
import type {
  AdminBillingPlan,
  UpdateSubscriptionPlanParams,
} from '../application/admin-billing.types';

@Injectable()
export class PrismaSubscriptionPlanAdminRepository extends SubscriptionPlanAdminPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async updatePlan(
    params: UpdateSubscriptionPlanParams,
  ): Promise<AdminBillingPlan> {
    const reason = params.reason.trim();
    if (reason.length < 5 || reason.length > 500) {
      throw new BadRequestException('Reason must contain 5-500 characters');
    }
    const changes = {
      ...(params.priceVnd !== undefined ? { priceVnd: params.priceVnd } : {}),
      ...(params.monthlyQuota !== undefined
        ? { monthlyQuota: params.monthlyQuota }
        : {}),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
    };
    if (Object.keys(changes).length === 0) {
      throw new BadRequestException(
        'Provide at least one plan field to update',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.subscriptionPlan.findUnique({
        where: { id: params.planId },
      });
      if (!current) throw new NotFoundException('Subscription plan not found');
      if (current.revision !== params.expectedRevision) {
        throw new ConflictException({
          code: 'STALE_REVISION',
          message: 'Plan changed; reload before continuing',
        });
      }

      const changed =
        (changes.priceVnd !== undefined &&
          changes.priceVnd !== current.priceVnd) ||
        (changes.monthlyQuota !== undefined &&
          changes.monthlyQuota !== current.monthlyQuota) ||
        (changes.isActive !== undefined &&
          changes.isActive !== current.isActive);
      if (!changed) return current;

      const updatedRows = await tx.subscriptionPlan.updateMany({
        where: { id: params.planId, revision: params.expectedRevision },
        data: { ...changes, revision: { increment: 1 } },
      });
      if (updatedRows.count !== 1) {
        throw new ConflictException({
          code: 'STALE_REVISION',
          message: 'Plan changed; reload before continuing',
        });
      }
      const updated = await tx.subscriptionPlan.findUniqueOrThrow({
        where: { id: params.planId },
      });
      await tx.adminAuditEvent.create({
        data: {
          actorType: 'ADMIN',
          actorId: params.adminId,
          targetType: 'SUBSCRIPTION_PLAN',
          targetId: params.planId,
          action: 'SUBSCRIPTION_PLAN_CHANGED',
          reason,
          before: {
            priceVnd: current.priceVnd,
            monthlyQuota: current.monthlyQuota,
            isActive: current.isActive,
            revision: current.revision,
          },
          after: {
            priceVnd: updated.priceVnd,
            monthlyQuota: updated.monthlyQuota,
            isActive: updated.isActive,
            revision: updated.revision,
          },
        },
      });
      return updated;
    });
  }
}
