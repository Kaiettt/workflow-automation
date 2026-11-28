import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PaymentOrderStatus, PaymentProvider, PlanCode } from '@prisma/client';
import { SUBSCRIPTION_PLAN_REPOSITORY } from '@app/subscription';
import type { SubscriptionPlanRepository } from '@app/subscription';
import { PAYMENT_ORDER_REPOSITORY } from '../../domain/repositories';
import type { PaymentOrderRepository } from '../../domain/repositories';
import { VNPayService } from '../../infrastructure/payment/vnpay/vnpay.service';

export class CreateCheckoutCommand {
  constructor(
    public readonly userId: string,
    public readonly planId: string,
    public readonly ipAddress?: string,
  ) {}
}

export interface CheckoutResultDto {
  transactionReference: string;
  paymentUrl: string;
}

@Injectable()
@CommandHandler(CreateCheckoutCommand)
export class CreateCheckoutHandler implements ICommandHandler<
  CreateCheckoutCommand,
  CheckoutResultDto
> {
  private readonly logger = new Logger(CreateCheckoutHandler.name);

  constructor(
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly paymentOrderRepo: PaymentOrderRepository,
    @Inject(SUBSCRIPTION_PLAN_REPOSITORY)
    private readonly planRepo: SubscriptionPlanRepository,
    private readonly vnpayService: VNPayService,
  ) {}

  async execute(command: CreateCheckoutCommand): Promise<CheckoutResultDto> {
    const plan = await this.planRepo.findById(command.planId);
    if (!plan || !plan.isActive) {
      this.log('payment.checkout.rejected', { reason: 'plan_not_found' });
      throw new NotFoundException('Plan not found');
    }

    if (plan.code === PlanCode.FREE || plan.priceVnd <= 0) {
      this.log('payment.checkout.rejected', {
        reason: 'free_plan',
        planCode: plan.code,
      });
      throw new BadRequestException('Cannot initiate checkout for Free plan');
    }

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = now.getFullYear();
    const MM = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const HH = pad(now.getHours());
    const mm = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    const randomSuffix = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    const transactionReference = `FP${yyyy}${MM}${dd}${HH}${mm}${ss}${randomSuffix}`;

    try {
      await this.paymentOrderRepo.create({
        orderCode: transactionReference,
        userId: command.userId,
        planId: plan.id,
        amountVnd: plan.priceVnd,
        status: PaymentOrderStatus.PENDING,
        provider: PaymentProvider.VNPAY,
      });

      const paymentUrl = this.vnpayService.createPaymentUrl({
        transactionReference,
        amount: plan.priceVnd,
        orderInfo: `Thanh toan FlowPilot ${plan.name}`,
        ipAddress: command.ipAddress || '127.0.0.1',
      });

      this.log('payment.checkout.created', {
        transactionReference,
        planCode: plan.code,
        amountVnd: plan.priceVnd,
        status: PaymentOrderStatus.PENDING,
      });

      return { transactionReference, paymentUrl };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'payment.checkout.failed',
          transactionReference,
          planCode: plan.code,
          amountVnd: plan.priceVnd,
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
      throw error;
    }
  }

  private log(event: string, details: Record<string, string | number>): void {
    this.logger.log(JSON.stringify({ event, ...details }));
  }
}
