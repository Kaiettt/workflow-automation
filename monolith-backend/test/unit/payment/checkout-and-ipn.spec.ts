import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { CommandBus, EventBus } from '@nestjs/cqrs';
import { PaymentOrderStatus, PaymentProvider, PlanCode } from '@prisma/client';
import { PrismaService } from '@app/database';
import {
  SUBSCRIPTION_PLAN_REPOSITORY,
  SubscriptionPlanRepository,
} from '@app/subscription';
import {
  CreateCheckoutCommand,
  CreateCheckoutHandler,
} from '@app/payment/application/commands/create-checkout.command';
import {
  HandleVNPayIpnCommand,
  HandleVNPayIpnHandler,
} from '@app/payment/application/commands/handle-vnpay-ipn.command';
import {
  VerifyVNPayReturnCommand,
  VerifyVNPayReturnHandler,
} from '@app/payment/application/commands/verify-vnpay-return.command';
import {
  PAYMENT_ORDER_REPOSITORY,
  PaymentOrderRepository,
} from '@app/payment/domain/repositories';
import { PrismaPaymentOrderRepository } from '@app/payment/infrastructure/persistence/prisma-payment-order.repository';
import { VNPayService } from '@app/payment/infrastructure/payment/vnpay/vnpay.service';

function loggedEvent(
  spy: jest.SpyInstance,
  event: string,
): Record<string, unknown> | undefined {
  const message = spy.mock.calls
    .map(([value]) => String(value))
    .find((value) => value.includes(`"event":"${event}"`));
  return message ? (JSON.parse(message) as Record<string, unknown>) : undefined;
}

describe('Checkout and IPN Handlers (Ticket 3 - Tasks 3.3 & 3.4)', () => {
  let checkoutHandler: CreateCheckoutHandler;
  let ipnHandler: HandleVNPayIpnHandler;

  let paymentOrderRepo: jest.Mocked<PaymentOrderRepository>;
  let planRepo: jest.Mocked<SubscriptionPlanRepository>;
  let vnpayService: jest.Mocked<VNPayService>;
  let eventBus: jest.Mocked<EventBus>;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const mockPlan = {
    id: 'plan-pro-id',
    code: PlanCode.PRO,
    name: 'Pro',
    priceVnd: 299000,
    monthlyQuota: 5000,
    isActive: true,
  };

  beforeEach(async () => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    paymentOrderRepo = {
      create: jest.fn(),
      findByOrderCode: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
      findByUserId: jest.fn(),
      updatePendingOrder: jest.fn(),
      findUnprocessedOutboxEvents: jest.fn(),
      markOutboxEventProcessed: jest.fn(),
    } as any;

    planRepo = {
      findById: jest.fn(),
      findByCode: jest.fn(),
      findAllActive: jest.fn(),
    } as any;

    vnpayService = {
      createPaymentUrl: jest.fn(),
      verifyCallback: jest.fn(),
      processCallback: jest.fn(),
    } as any;
    eventBus = { publish: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateCheckoutHandler,
        HandleVNPayIpnHandler,
        { provide: PAYMENT_ORDER_REPOSITORY, useValue: paymentOrderRepo },
        { provide: SUBSCRIPTION_PLAN_REPOSITORY, useValue: planRepo },
        { provide: VNPayService, useValue: vnpayService },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    checkoutHandler = module.get<CreateCheckoutHandler>(CreateCheckoutHandler);
    ipnHandler = module.get<HandleVNPayIpnHandler>(HandleVNPayIpnHandler);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('CreateCheckoutHandler [SCENARIO-SUB-05]', () => {
    it('should create PENDING payment order and generate signed VNPay URL for valid paid plan', async () => {
      planRepo.findById.mockResolvedValue(mockPlan as any);
      paymentOrderRepo.create.mockImplementation((data) =>
        Promise.resolve({
          id: 'order-123',
          ...data,
        }),
      );
      vnpayService.createPaymentUrl.mockReturnValue(
        'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=29900000',
      );

      const result = await checkoutHandler.execute(
        new CreateCheckoutCommand('user-123', mockPlan.id, '127.0.0.1'),
      );

      expect(planRepo.findById).toHaveBeenCalledWith(mockPlan.id);
      expect(paymentOrderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          planId: mockPlan.id,
          amountVnd: 299000,
          status: PaymentOrderStatus.PENDING,
          provider: PaymentProvider.VNPAY,
        }),
      );
      expect(vnpayService.createPaymentUrl).toHaveBeenCalled();
      expect(result.paymentUrl).toContain('vnp_Amount=29900000');
      expect(result.transactionReference).toBeDefined();
      const checkoutLog = loggedEvent(logSpy, 'payment.checkout.created');
      expect(checkoutLog).toEqual(
        expect.objectContaining({
          transactionReference: result.transactionReference,
          planCode: PlanCode.PRO,
          amountVnd: mockPlan.priceVnd,
          status: PaymentOrderStatus.PENDING,
        }),
      );
      expect(checkoutLog).not.toHaveProperty('userId');
      expect(checkoutLog).not.toHaveProperty('paymentUrl');
    });

    it('should reject checkout for Free plan with BadRequestException', async () => {
      planRepo.findById.mockResolvedValue({
        ...mockPlan,
        code: PlanCode.FREE,
        priceVnd: 0,
      } as any);

      await expect(
        checkoutHandler.execute(
          new CreateCheckoutCommand('user-123', mockPlan.id, '127.0.0.1'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should log checkout provider failures without exposing provider details', async () => {
      planRepo.findById.mockResolvedValue(mockPlan as any);
      paymentOrderRepo.create.mockResolvedValue({
        id: 'order-123',
        orderCode: 'FP12345678',
        userId: 'user-123',
        planId: mockPlan.id,
        amountVnd: mockPlan.priceVnd,
        status: PaymentOrderStatus.PENDING,
        provider: PaymentProvider.VNPAY,
      });
      vnpayService.createPaymentUrl.mockImplementation(() => {
        throw new Error('provider URL contains sensitive details');
      });

      await expect(
        checkoutHandler.execute(
          new CreateCheckoutCommand('user-123', mockPlan.id, '127.0.0.1'),
        ),
      ).rejects.toThrow('provider URL contains sensitive details');

      const failureLog = loggedEvent(errorSpy, 'payment.checkout.failed');
      expect(failureLog).toEqual(
        expect.objectContaining({
          planCode: PlanCode.PRO,
          amountVnd: mockPlan.priceVnd,
          errorType: 'Error',
        }),
      );
      expect(JSON.stringify(failureLog)).not.toContain('user-123');
      expect(JSON.stringify(failureLog)).not.toContain('sensitive details');
    });

    it('should throw NotFoundException if plan does not exist', async () => {
      planRepo.findById.mockResolvedValue(null);

      await expect(
        checkoutHandler.execute(
          new CreateCheckoutCommand('user-123', 'non-existent-id', '127.0.0.1'),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('HandleVNPayIpnHandler [SCENARIO-SUB-06], [SCENARIO-SUB-07], [SCENARIO-SUB-08]', () => {
    it('should return RspCode 97 when signature is invalid', async () => {
      vnpayService.verifyCallback.mockReturnValue(false);

      const result = await ipnHandler.execute(
        new HandleVNPayIpnCommand({
          vnp_SecureHash: 'invalid_hash',
          vnp_TxnRef: 'FP12345678',
        }),
      );

      const rejectedLog = loggedEvent(warnSpy, 'payment.ipn.rejected');
      expect(rejectedLog).toEqual(
        expect.objectContaining({ reason: 'invalid_signature' }),
      );
      expect(JSON.stringify(rejectedLog)).not.toContain('invalid_hash');

      expect(result).toEqual({
        RspCode: '97',
        Message: 'Invalid Checksum',
      });
    });

    it('should return RspCode 01 when order does not exist', async () => {
      vnpayService.verifyCallback.mockReturnValue(true);
      paymentOrderRepo.findByOrderCode.mockResolvedValue(null);

      const result = await ipnHandler.execute(
        new HandleVNPayIpnCommand({
          vnp_SecureHash: 'valid_hash',
          vnp_TxnRef: 'NON_EXISTENT',
        }),
      );

      expect(result).toEqual({
        RspCode: '01',
        Message: 'Order not Found',
      });
    });

    it('should return RspCode 02 when order is already confirmed (idempotency)', async () => {
      vnpayService.verifyCallback.mockReturnValue(true);
      paymentOrderRepo.findByOrderCode.mockResolvedValue({
        id: 'order-123',
        orderCode: 'FP12345678',
        userId: 'user-123',
        planId: mockPlan.id,
        amountVnd: 299000,
        status: PaymentOrderStatus.COMPLETED,
        provider: PaymentProvider.VNPAY,
      });

      const result = await ipnHandler.execute(
        new HandleVNPayIpnCommand({
          vnp_SecureHash: 'valid_hash',
          vnp_TxnRef: 'FP12345678',
          vnp_Amount: '29900000',
        }),
      );

      expect(result).toEqual({
        RspCode: '02',
        Message: 'Order already confirmed',
      });
      expect(paymentOrderRepo.updatePendingOrder).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should return RspCode 04 when payment amount does not match order amount', async () => {
      vnpayService.verifyCallback.mockReturnValue(true);
      paymentOrderRepo.findByOrderCode.mockResolvedValue({
        id: 'order-123',
        orderCode: 'FP12345678',
        userId: 'user-123',
        planId: mockPlan.id,
        amountVnd: 299000,
        status: PaymentOrderStatus.PENDING,
        provider: PaymentProvider.VNPAY,
      });

      const result = await ipnHandler.execute(
        new HandleVNPayIpnCommand({
          vnp_SecureHash: 'valid_hash',
          vnp_TxnRef: 'FP12345678',
          vnp_Amount: '10000000', // tampered amount
        }),
      );

      expect(result).toEqual({
        RspCode: '04',
        Message: 'Invalid Amount',
      });
      expect(paymentOrderRepo.updatePendingOrder).not.toHaveBeenCalled();
    });

    it('should complete the order; the repository records fulfillment durably', async () => {
      vnpayService.verifyCallback.mockReturnValue(true);
      paymentOrderRepo.findByOrderCode.mockResolvedValue({
        id: 'order-123',
        orderCode: 'FP12345678',
        userId: 'user-123',
        planId: mockPlan.id,
        amountVnd: 299000,
        status: PaymentOrderStatus.PENDING,
        provider: PaymentProvider.VNPAY,
      });
      paymentOrderRepo.updatePendingOrder.mockResolvedValue(true);

      const result = await ipnHandler.execute(
        new HandleVNPayIpnCommand({
          vnp_SecureHash: 'valid_hash',
          vnp_TxnRef: 'FP12345678',
          vnp_Amount: '29900000',
          vnp_ResponseCode: '00',
          vnp_TransactionStatus: '00',
          vnp_TransactionNo: '14567890',
          vnp_BankCode: 'NCB',
          vnp_PayDate: '20261128140000',
        }),
      );

      expect(result).toEqual({
        RspCode: '00',
        Message: 'Confirm Success',
      });
      const transitionLog = loggedEvent(logSpy, 'payment.ipn.transitioned');
      expect(transitionLog).toEqual(
        expect.objectContaining({
          transactionReference: 'FP12345678',
          amountVnd: 299000,
          status: PaymentOrderStatus.COMPLETED,
          responseCode: '00',
        }),
      );
      expect(transitionLog).not.toHaveProperty('signature');
      expect(paymentOrderRepo.updatePendingOrder).toHaveBeenCalledWith(
        'FP12345678',
        PaymentOrderStatus.COMPLETED,
        expect.objectContaining({
          transactionNo: '14567890',
          bankCode: 'NCB',
          responseCode: '00',
          payDate: expect.any(Date),
        }),
      );
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should mark a non-success payment as FAILED without publishing a completion event', async () => {
      vnpayService.verifyCallback.mockReturnValue(true);
      paymentOrderRepo.findByOrderCode.mockResolvedValue({
        id: 'order-123',
        orderCode: 'FP12345678',
        userId: 'user-123',
        planId: mockPlan.id,
        amountVnd: 299000,
        status: PaymentOrderStatus.PENDING,
        provider: PaymentProvider.VNPAY,
      });
      paymentOrderRepo.updatePendingOrder.mockResolvedValue(true);

      const result = await ipnHandler.execute(
        new HandleVNPayIpnCommand({
          vnp_SecureHash: 'valid_hash',
          vnp_TxnRef: 'FP12345678',
          vnp_Amount: '29900000',
          vnp_ResponseCode: '24',
        }),
      );

      expect(result).toEqual({ RspCode: '00', Message: 'Confirm Success' });
      expect(paymentOrderRepo.updatePendingOrder).toHaveBeenCalledWith(
        'FP12345678',
        PaymentOrderStatus.FAILED,
        expect.objectContaining({ responseCode: '24' }),
      );
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should not publish completion when another IPN already transitioned the order', async () => {
      vnpayService.verifyCallback.mockReturnValue(true);
      paymentOrderRepo.findByOrderCode.mockResolvedValue({
        id: 'order-123',
        orderCode: 'FP12345678',
        userId: 'user-123',
        planId: mockPlan.id,
        amountVnd: 299000,
        status: PaymentOrderStatus.PENDING,
        provider: PaymentProvider.VNPAY,
      });
      paymentOrderRepo.updatePendingOrder.mockResolvedValue(false);

      const result = await ipnHandler.execute(
        new HandleVNPayIpnCommand({
          vnp_SecureHash: 'valid_hash',
          vnp_TxnRef: 'FP12345678',
          vnp_Amount: '29900000',
          vnp_ResponseCode: '00',
          vnp_TransactionStatus: '00',
        }),
      );

      expect(result).toEqual({
        RspCode: '02',
        Message: 'Order already confirmed',
      });
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('should settle a signed successful browser return through the IPN transition', async () => {
      vnpayService.verifyCallback.mockReturnValue(true);
      paymentOrderRepo.findByOrderCode.mockResolvedValue({
        id: 'order-123',
        orderCode: 'FP12345678',
        userId: 'user-123',
        planId: mockPlan.id,
        amountVnd: 299000,
        status: PaymentOrderStatus.PENDING,
        provider: PaymentProvider.VNPAY,
      });
      paymentOrderRepo.updatePendingOrder.mockResolvedValue(true);
      const commandBus = {
        execute: jest.fn((command: HandleVNPayIpnCommand) =>
          ipnHandler.execute(command),
        ),
      };
      const returnHandler = new VerifyVNPayReturnHandler(
        vnpayService,
        commandBus as unknown as CommandBus,
      );
      const params = {
        vnp_SecureHash: 'valid_hash',
        vnp_TxnRef: 'FP12345678',
        vnp_Amount: '29900000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
        vnp_TransactionNo: '14567890',
      };

      await expect(
        returnHandler.execute(new VerifyVNPayReturnCommand(params)),
      ).resolves.toEqual({
        transactionReference: 'FP12345678',
        signatureValid: true,
        successful: true,
      });

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ params, source: 'return' }),
      );
      expect(paymentOrderRepo.updatePendingOrder).toHaveBeenCalledWith(
        'FP12345678',
        PaymentOrderStatus.COMPLETED,
        expect.objectContaining({
          transactionNo: '14567890',
          responseCode: '00',
        }),
      );
      expect(loggedEvent(logSpy, 'payment.return.transitioned')).toEqual(
        expect.objectContaining({
          transactionReference: 'FP12345678',
          status: PaymentOrderStatus.COMPLETED,
        }),
      );
    });

    it('does not settle a browser return with an invalid signature', async () => {
      vnpayService.verifyCallback.mockReturnValue(false);
      const commandBus = { execute: jest.fn() };
      const returnHandler = new VerifyVNPayReturnHandler(
        vnpayService,
        commandBus as unknown as CommandBus,
      );

      await returnHandler.execute(
        new VerifyVNPayReturnCommand({
          vnp_TxnRef: 'FP12345678',
          vnp_SecureHash: 'invalid_hash',
        }),
      );

      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });
});

describe('VerifyVNPayReturnHandler logging', () => {
  it('logs verification outcome without callback signature or payload', async () => {
    const logger = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const vnpay = {
      verifyCallback: jest.fn().mockReturnValue(true),
    } as unknown as VNPayService;
    const commandBus = {
      execute: jest.fn().mockResolvedValue({
        RspCode: '00',
        Message: 'Confirm Success',
      }),
    } as unknown as CommandBus;
    const handler = new VerifyVNPayReturnHandler(vnpay, commandBus);

    await expect(
      handler.execute(
        new VerifyVNPayReturnCommand({
          vnp_TxnRef: 'FP12345678',
          vnp_ResponseCode: '00',
          vnp_TransactionStatus: '00',
          vnp_SecureHash: 'sensitive-hash',
        }),
      ),
    ).resolves.toEqual({
      transactionReference: 'FP12345678',
      signatureValid: true,
      successful: true,
    });

    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('"event":"payment.return.verified"'),
    );
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'return' }),
    );
    expect(logger.mock.calls[0][0]).not.toContain('sensitive-hash');
    logger.mockRestore();
  });
});

describe('PrismaPaymentOrderRepository conditional transition', () => {
  it('should transition a pending order and atomically store its completion event', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = jest.fn().mockResolvedValue({
      userId: 'user-123',
      planId: 'plan-123',
      orderCode: 'FP12345678',
    });
    const create = jest.fn();
    const tx = {
      paymentOrder: { updateMany, findUniqueOrThrow },
      billingOutboxEvent: { create },
    };
    const repository = new PrismaPaymentOrderRepository({
      $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    } as unknown as PrismaService);

    await expect(
      repository.updatePendingOrder(
        'FP12345678',
        PaymentOrderStatus.COMPLETED,
        {
          responseCode: '00',
        },
      ),
    ).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        orderCode: 'FP12345678',
        status: PaymentOrderStatus.PENDING,
      },
      data: {
        status: PaymentOrderStatus.COMPLETED,
        responseCode: '00',
      },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        idempotencyKey: 'payment-completed:FP12345678',
        eventType: 'PaymentCompletedEvent',
        payload: {
          userId: 'user-123',
          planId: 'plan-123',
          orderCode: 'FP12345678',
        },
      },
    });
  });

  it('should report a lost transition when the order is no longer pending', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const repository = new PrismaPaymentOrderRepository({
      $transaction: (
        work: (client: {
          paymentOrder: { updateMany: typeof updateMany };
        }) => Promise<unknown>,
      ) => work({ paymentOrder: { updateMany } }),
    } as unknown as PrismaService);

    await expect(
      repository.updatePendingOrder('FP12345678', PaymentOrderStatus.FAILED),
    ).resolves.toBe(false);
  });
});
