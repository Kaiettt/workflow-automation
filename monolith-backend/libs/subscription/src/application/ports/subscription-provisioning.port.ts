import { SubscriptionModel } from '../../domain/entities';

export const SUBSCRIPTION_PROVISIONING_PORT = Symbol(
  'SUBSCRIPTION_PROVISIONING_PORT',
);

export interface SubscriptionProvisioningPort {
  allocateDefaultFreeSubscription(userId: string): Promise<SubscriptionModel>;
  getActiveSubscription(userId: string): Promise<SubscriptionModel | null>;
}
