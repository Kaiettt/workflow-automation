import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type {
  AdminBillingPlan,
  UpdateSubscriptionPlanParams,
} from './admin-billing.types';

export abstract class SubscriptionPlanAdminPort {
  abstract updatePlan(
    params: UpdateSubscriptionPlanParams,
  ): Promise<AdminBillingPlan>;
}

export class UpdateSubscriptionPlanCommand {
  constructor(readonly params: UpdateSubscriptionPlanParams) {}
}

@CommandHandler(UpdateSubscriptionPlanCommand)
export class UpdateSubscriptionPlanHandler implements ICommandHandler<UpdateSubscriptionPlanCommand> {
  constructor(private readonly plans: SubscriptionPlanAdminPort) {}
  execute(command: UpdateSubscriptionPlanCommand): Promise<AdminBillingPlan> {
    return this.plans.updatePlan(command.params);
  }
}
