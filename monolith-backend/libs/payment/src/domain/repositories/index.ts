import { PaymentOrderStatus } from '@prisma/client';
import { PaymentOrderModel } from '../entities';

export const PAYMENT_ORDER_REPOSITORY = Symbol('PAYMENT_ORDER_REPOSITORY');

export interface PaymentOutboxEventModel {
  id: string;
  eventType: string;
  payload: unknown;
}

export interface PaymentOrderRepository {
  create(
    data: Omit<PaymentOrderModel, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<PaymentOrderModel>;
  findByOrderCode(orderCode: string): Promise<PaymentOrderModel | null>;
  findById(id: string): Promise<PaymentOrderModel | null>;
  updateStatus(
    id: string,
    status: PaymentOrderStatus,
    details?: {
      transactionNo?: string | null;
      bankCode?: string | null;
      responseCode?: string | null;
      payDate?: Date | null;
    },
  ): Promise<PaymentOrderModel>;
  updatePendingOrder(
    orderCode: string,
    status: PaymentOrderStatus,
    details?: {
      transactionNo?: string | null;
      bankCode?: string | null;
      responseCode?: string | null;
      payDate?: Date | null;
    },
  ): Promise<boolean>;
  findByUserId(userId: string): Promise<PaymentOrderModel[]>;
  findUnprocessedOutboxEvents(
    limit: number,
  ): Promise<PaymentOutboxEventModel[]>;
  markOutboxEventProcessed(id: string, processedAt: Date): Promise<void>;
}
