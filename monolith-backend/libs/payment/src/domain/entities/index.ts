import { PaymentOrderStatus, PaymentProvider } from '@prisma/client';

export interface PaymentOrderModel {
  id: string;
  orderCode: string;
  userId: string;
  planId: string;
  amountVnd: number;
  status: PaymentOrderStatus;
  provider: PaymentProvider;
  transactionNo?: string | null;
  bankCode?: string | null;
  responseCode?: string | null;
  payDate?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
