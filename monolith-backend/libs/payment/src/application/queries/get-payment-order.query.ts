import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PAYMENT_ORDER_REPOSITORY } from '../../domain/repositories';
import type { PaymentOrderRepository } from '../../domain/repositories';

export class GetPaymentOrderQuery {
  constructor(
    public readonly userId: string,
    public readonly orderCode: string,
  ) {}
}

export class GetPaymentHistoryQuery {
  constructor(public readonly userId: string) {}
}

export interface PaymentOrderDto {
  id: string;
  orderCode: string;
  amountVnd: number;
  status: string;
  createdAt: Date;
  payDate?: Date | null;
}

@Injectable()
@QueryHandler(GetPaymentOrderQuery)
export class GetPaymentOrderHandler implements IQueryHandler<
  GetPaymentOrderQuery,
  PaymentOrderDto
> {
  constructor(
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly paymentOrderRepo: PaymentOrderRepository,
  ) {}

  async execute(query: GetPaymentOrderQuery): Promise<PaymentOrderDto> {
    const order = await this.paymentOrderRepo.findByOrderCode(query.orderCode);
    if (!order) {
      throw new NotFoundException('Payment order not found');
    }
    if (order.userId !== query.userId) {
      throw new ForbiddenException('Access to payment order denied');
    }

    return {
      id: order.id,
      orderCode: order.orderCode,
      amountVnd: order.amountVnd,
      status: order.status,
      createdAt: order.createdAt || new Date(),
      payDate: order.payDate,
    };
  }
}

@Injectable()
@QueryHandler(GetPaymentHistoryQuery)
export class GetPaymentHistoryHandler implements IQueryHandler<
  GetPaymentHistoryQuery,
  PaymentOrderDto[]
> {
  constructor(
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly paymentOrderRepo: PaymentOrderRepository,
  ) {}

  async execute(query: GetPaymentHistoryQuery): Promise<PaymentOrderDto[]> {
    const orders = await this.paymentOrderRepo.findByUserId(query.userId);
    return orders.map((order) => ({
      id: order.id,
      orderCode: order.orderCode,
      amountVnd: order.amountVnd,
      status: order.status,
      createdAt: order.createdAt || new Date(),
      payDate: order.payDate,
    }));
  }
}
