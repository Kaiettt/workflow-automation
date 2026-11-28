import { Injectable } from '@nestjs/common';
import { PaymentOrderStatus } from '@prisma/client';
import { PrismaService } from '@app/database';
import { PaymentOrderModel } from '../../domain/entities';
import { PaymentOrderRepository } from '../../domain/repositories';

@Injectable()
export class PrismaPaymentOrderRepository implements PaymentOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Omit<PaymentOrderModel, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<PaymentOrderModel> {
    return this.prisma.paymentOrder.create({
      data: {
        orderCode: data.orderCode,
        userId: data.userId,
        planId: data.planId,
        amountVnd: data.amountVnd,
        status: data.status,
        provider: data.provider,
        transactionNo: data.transactionNo,
        bankCode: data.bankCode,
        responseCode: data.responseCode,
        payDate: data.payDate,
      },
    });
  }

  async findByOrderCode(orderCode: string): Promise<PaymentOrderModel | null> {
    return this.prisma.paymentOrder.findUnique({
      where: { orderCode },
    });
  }

  async findById(id: string): Promise<PaymentOrderModel | null> {
    return this.prisma.paymentOrder.findUnique({
      where: { id },
    });
  }

  async updateStatus(
    id: string,
    status: PaymentOrderStatus,
    details?: {
      transactionNo?: string | null;
      bankCode?: string | null;
      responseCode?: string | null;
      payDate?: Date | null;
    },
  ): Promise<PaymentOrderModel> {
    return this.prisma.paymentOrder.update({
      where: { id },
      data: {
        status,
        ...(details?.transactionNo !== undefined && {
          transactionNo: details.transactionNo,
        }),
        ...(details?.bankCode !== undefined && { bankCode: details.bankCode }),
        ...(details?.responseCode !== undefined && {
          responseCode: details.responseCode,
        }),
        ...(details?.payDate !== undefined && { payDate: details.payDate }),
      },
    });
  }

  async updatePendingOrder(
    orderCode: string,
    status: PaymentOrderStatus,
    details?: {
      transactionNo?: string | null;
      bankCode?: string | null;
      responseCode?: string | null;
      payDate?: Date | null;
    },
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.paymentOrder.updateMany({
        where: { orderCode, status: PaymentOrderStatus.PENDING },
        data: {
          status,
          ...(details?.transactionNo !== undefined && {
            transactionNo: details.transactionNo,
          }),
          ...(details?.bankCode !== undefined && {
            bankCode: details.bankCode,
          }),
          ...(details?.responseCode !== undefined && {
            responseCode: details.responseCode,
          }),
          ...(details?.payDate !== undefined && { payDate: details.payDate }),
        },
      });

      if (result.count === 1 && status === PaymentOrderStatus.COMPLETED) {
        const order = await tx.paymentOrder.findUniqueOrThrow({
          where: { orderCode },
        });
        await tx.billingOutboxEvent.create({
          data: {
            idempotencyKey: `payment-completed:${orderCode}`,
            eventType: 'PaymentCompletedEvent',
            payload: {
              userId: order.userId,
              planId: order.planId,
              orderCode: order.orderCode,
            },
          },
        });
      }
      return result.count === 1;
    });
  }

  async findByUserId(userId: string): Promise<PaymentOrderModel[]> {
    return this.prisma.paymentOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findUnprocessedOutboxEvents(limit: number) {
    return this.prisma.billingOutboxEvent.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true, eventType: true, payload: true },
    });
  }

  async markOutboxEventProcessed(id: string, processedAt: Date): Promise<void> {
    await this.prisma.billingOutboxEvent.updateMany({
      where: { id, processedAt: null },
      data: { processedAt },
    });
  }
}
