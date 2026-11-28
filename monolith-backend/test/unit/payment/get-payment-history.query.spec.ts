import { PaymentOrderStatus, PaymentProvider } from '@prisma/client';
import { GetPaymentHistoryHandler } from '../../../libs/payment/src/application/queries/get-payment-order.query';
import type { PaymentOrderRepository } from '../../../libs/payment/src/domain/repositories';

describe('GetPaymentHistoryHandler', () => {
  it('returns only the requesting user’s safe payment history fields', async () => {
    const order = {
      id: 'order-id',
      orderCode: 'ORDER-1',
      userId: 'user-1',
      planId: 'plan-id',
      amountVnd: 299000,
      status: PaymentOrderStatus.COMPLETED,
      provider: PaymentProvider.VNPAY,
      transactionNo: 'provider-transaction',
      bankCode: 'BANK',
      responseCode: '00',
      payDate: new Date('2026-11-28T00:00:00Z'),
      createdAt: new Date('2026-11-27T00:00:00Z'),
    };
    const repository: jest.Mocked<PaymentOrderRepository> = {
      create: jest.fn(),
      findByOrderCode: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
      updatePendingOrder: jest.fn(),
      findByUserId: jest.fn().mockResolvedValue([order]),
      findUnprocessedOutboxEvents: jest.fn(),
      markOutboxEventProcessed: jest.fn(),
    };
    const handler = new GetPaymentHistoryHandler(repository);

    await expect(handler.execute({ userId: 'user-1' })).resolves.toEqual([
      {
        id: 'order-id',
        orderCode: 'ORDER-1',
        amountVnd: 299000,
        status: PaymentOrderStatus.COMPLETED,
        createdAt: order.createdAt,
        payDate: order.payDate,
      },
    ]);
    expect(repository.findByUserId).toHaveBeenCalledWith('user-1');
  });
});
