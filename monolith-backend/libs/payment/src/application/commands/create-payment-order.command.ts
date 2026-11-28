import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PaymentOrderStatus, PaymentProvider, PlanCode } from '@prisma/client';
import { SUBSCRIPTION_PLAN_REPOSITORY } from '@app/subscription';
import type { SubscriptionPlanRepository } from '@app/subscription';
import { PAYMENT_ORDER_REPOSITORY } from '../../domain/repositories';
import type { PaymentOrderRepository } from '../../domain/repositories';
import { VNPaySigner } from '../services/vnpay-signer.service';

export class CreatePaymentOrderCommand {
  constructor(
    public readonly userId: string,
    public readonly planCode: PlanCode,
    public readonly ipAddress?: string,
  ) {}
}

export interface CheckoutResultDto {
  orderId: string;
  orderCode: string;
  amountVnd: number;
  paymentUrl: string;
}

@Injectable()
@CommandHandler(CreatePaymentOrderCommand)
export class CreatePaymentOrderHandler implements ICommandHandler<
  CreatePaymentOrderCommand,
  CheckoutResultDto
> {
  constructor(
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly paymentOrderRepo: PaymentOrderRepository,
    @Inject(SUBSCRIPTION_PLAN_REPOSITORY)
    private readonly planRepo: SubscriptionPlanRepository,
  ) {}

  async execute(
    command: CreatePaymentOrderCommand,
  ): Promise<CheckoutResultDto> {
    const plan = await this.planRepo.findByCode(command.planCode);
    if (!plan) {
      throw new NotFoundException(`Plan ${command.planCode} not found`);
    }

    if (plan.code === PlanCode.FREE || plan.priceVnd <= 0) {
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
    const createDate = `${yyyy}${MM}${dd}${HH}${mm}${ss}`;

    const randomSuffix = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    const orderCode = `${now.getTime()}${randomSuffix}`;

    const order = await this.paymentOrderRepo.create({
      orderCode,
      userId: command.userId,
      planId: plan.id,
      amountVnd: plan.priceVnd,
      status: PaymentOrderStatus.PENDING,
      provider: PaymentProvider.VNPAY,
    });

    const tmnCode = process.env.VNPAY_TMN_CODE!;
    const hashSecret = process.env.VNPAY_HASH_SECRET!;
    const paymentUrlEndpoint = process.env.VNPAY_PAYMENT_URL!;
    const returnUrl = process.env.VNPAY_RETURN_URL!;

    const vnpParams: Record<string, string | number> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: plan.priceVnd * 100,
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderCode,
      vnp_OrderInfo: `Thanh toan FlowPilot ${plan.name}`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: command.ipAddress || '127.0.0.1',
      vnp_CreateDate: createDate,
    };

    const secureHash = VNPaySigner.sign(vnpParams, hashSecret);
    const queryString = VNPaySigner.buildCanonicalQuery(vnpParams);
    const paymentUrl = `${paymentUrlEndpoint}?${queryString}&vnp_SecureHash=${secureHash}`;

    return {
      orderId: order.id,
      orderCode,
      amountVnd: plan.priceVnd,
      paymentUrl,
    };
  }
}
