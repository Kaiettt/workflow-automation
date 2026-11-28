import { Inject, Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SUBSCRIPTION_PLAN_REPOSITORY } from '@app/subscription';
import type {
  SubscriptionPlanRepository,
  SubscriptionPlanModel,
} from '@app/subscription';

export class GetPlansQuery {}

@Injectable()
@QueryHandler(GetPlansQuery)
export class GetPlansHandler implements IQueryHandler<
  GetPlansQuery,
  SubscriptionPlanModel[]
> {
  constructor(
    @Inject(SUBSCRIPTION_PLAN_REPOSITORY)
    private readonly planRepo: SubscriptionPlanRepository,
  ) {}

  async execute(): Promise<SubscriptionPlanModel[]> {
    return this.planRepo.findAllActive();
  }
}
