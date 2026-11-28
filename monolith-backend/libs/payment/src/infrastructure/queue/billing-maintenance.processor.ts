import { Inject, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PAYMENT_ORDER_REPOSITORY } from '../../domain/repositories';
import type { PaymentOrderRepository } from '../../domain/repositories';
import { SubscriptionLifecycleService } from '@app/subscription';

export const BILLING_MAINTENANCE_QUEUE = 'billing-maintenance';

function isPaymentCompletedPayload(
  value: unknown,
): value is { userId: string; planId: string; orderCode: string } {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'userId' in value &&
    'planId' in value &&
    'orderCode' in value &&
    typeof value.userId === 'string' &&
    typeof value.planId === 'string' &&
    typeof value.orderCode === 'string'
  );
}

@Processor(BILLING_MAINTENANCE_QUEUE)
export class BillingMaintenanceProcessor
  extends WorkerHost
  implements OnModuleInit
{
  constructor(
    @InjectQueue(BILLING_MAINTENANCE_QUEUE) private readonly queue: Queue,
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly paymentOrders: PaymentOrderRepository,
    private readonly subscriptionLifecycle: SubscriptionLifecycleService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'billing-maintenance-hourly',
      { every: 60 * 60 * 1000 },
      { name: 'run', data: {} },
    );
  }

  async process(_job: Job): Promise<void> {
    void _job;
    const events = await this.paymentOrders.findUnprocessedOutboxEvents(100);
    for (const event of events) {
      if (event.eventType !== 'PaymentCompletedEvent') {
        throw new Error(`Unsupported billing outbox event: ${event.eventType}`);
      }
      if (!isPaymentCompletedPayload(event.payload)) {
        throw new Error(
          `Invalid payment completion event payload: ${event.id}`,
        );
      }

      await this.subscriptionLifecycle.handlePaymentCompleted(event.payload);
      await this.paymentOrders.markOutboxEventProcessed(event.id, new Date());
    }

    await this.subscriptionLifecycle.runScheduledLifecycle();
  }
}
