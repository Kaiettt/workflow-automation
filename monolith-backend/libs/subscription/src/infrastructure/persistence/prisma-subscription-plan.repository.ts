import { Injectable } from '@nestjs/common';
import { PlanCode } from '@prisma/client';
import { PrismaService } from '@app/database';
import { SubscriptionPlanModel } from '../../domain/entities';
import { SubscriptionPlanRepository } from '../../domain/repositories';

@Injectable()
export class PrismaSubscriptionPlanRepository implements SubscriptionPlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCode(code: PlanCode): Promise<SubscriptionPlanModel | null> {
    return this.prisma.subscriptionPlan.findUnique({
      where: { code },
    });
  }

  async findById(id: string): Promise<SubscriptionPlanModel | null> {
    return this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
  }

  async findAllActive(): Promise<SubscriptionPlanModel[]> {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { priceVnd: 'asc' },
    });
  }
}
