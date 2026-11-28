import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@app/database';
import { SubscriptionModule } from '@app/subscription';
import { AuthModule } from '@app/auth';
import { PAYMENT_ORDER_REPOSITORY } from './domain/repositories';
import { PrismaPaymentOrderRepository } from './infrastructure/persistence/prisma-payment-order.repository';
import { VNPayService } from './infrastructure/payment/vnpay/vnpay.service';
import { CreateCheckoutHandler } from './application/commands/create-checkout.command';
import { HandleVNPayIpnHandler } from './application/commands/handle-vnpay-ipn.command';
import { VerifyVNPayReturnHandler } from './application/commands/verify-vnpay-return.command';
import {
  GetPaymentHistoryHandler,
  GetPaymentOrderHandler,
} from './application/queries/get-payment-order.query';
import { GetPlansHandler } from './application/queries/get-plans.query';
import { PaymentController } from './presentation/http/payment.controller';
import {
  BILLING_MAINTENANCE_QUEUE,
  BillingMaintenanceProcessor,
} from './infrastructure/queue/billing-maintenance.processor';

const CommandHandlers = [
  CreateCheckoutHandler,
  HandleVNPayIpnHandler,
  VerifyVNPayReturnHandler,
];

const QueryHandlers = [
  GetPaymentOrderHandler,
  GetPaymentHistoryHandler,
  GetPlansHandler,
];

@Module({
  imports: [
    CqrsModule,
    PrismaModule,
    SubscriptionModule,
    AuthModule,
    BullModule.registerQueue({ name: BILLING_MAINTENANCE_QUEUE }),
  ],
  controllers: [PaymentController],
  providers: [
    {
      provide: PAYMENT_ORDER_REPOSITORY,
      useClass: PrismaPaymentOrderRepository,
    },
    VNPayService,
    ...CommandHandlers,
    ...QueryHandlers,
    BillingMaintenanceProcessor,
  ],
  exports: [PAYMENT_ORDER_REPOSITORY, VNPayService],
})
export class PaymentModule {}
