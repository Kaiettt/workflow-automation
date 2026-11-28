import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PaymentOrderStatus } from '@prisma/client';
import { PAYMENT_ORDER_REPOSITORY } from '../../domain/repositories';
import type { PaymentOrderRepository } from '../../domain/repositories';
import { VNPayService } from '../../infrastructure/payment/vnpay/vnpay.service';

export class HandleVNPayIpnCommand {
  constructor(
    public readonly params: Record<string, string>,
    public readonly source: 'ipn' | 'return' = 'ipn',
  ) {}
}

export interface VNPayIpnResponse {
  RspCode: string;
  Message: string;
}

@Injectable()
@CommandHandler(HandleVNPayIpnCommand)
export class HandleVNPayIpnHandler implements ICommandHandler<
  HandleVNPayIpnCommand,
  VNPayIpnResponse
> {
  private readonly logger = new Logger(HandleVNPayIpnHandler.name);

  constructor(
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly paymentOrderRepo: PaymentOrderRepository,
    private readonly vnpayService: VNPayService,
  ) {}

  async execute(command: HandleVNPayIpnCommand): Promise<VNPayIpnResponse> {
    const { params } = command;

    // 1. Verify signature
    const isValidSignature = this.vnpayService.verifyCallback(params);
    if (!isValidSignature) {
      this.log(`payment.${command.source}.rejected`, {
        reason: 'invalid_signature',
        responseCode: '97',
      });
      return { RspCode: '97', Message: 'Invalid Checksum' };
    }

    const orderCode = params.vnp_TxnRef;
    if (!orderCode) {
      this.log(`payment.${command.source}.rejected`, {
        reason: 'missing_transaction_reference',
        responseCode: '01',
      });
      return { RspCode: '01', Message: 'Order not Found' };
    }

    // 2. Find order
    const order = await this.paymentOrderRepo.findByOrderCode(orderCode);
    if (!order) {
      this.log(`payment.${command.source}.rejected`, {
        reason: 'order_not_found',
        transactionReference: orderCode,
        responseCode: '01',
      });
      return { RspCode: '01', Message: 'Order not Found' };
    }

    // 3. Check already confirmed (idempotency)
    if (order.status !== PaymentOrderStatus.PENDING) {
      this.log(`payment.${command.source}.duplicate`, {
        transactionReference: orderCode,
        status: order.status,
        responseCode: '02',
      });
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    // 4. Validate amount
    const vnpAmount = Number(params.vnp_Amount);
    if (order.amountVnd * 100 !== vnpAmount) {
      this.log(`payment.${command.source}.rejected`, {
        reason: 'amount_mismatch',
        transactionReference: orderCode,
        expectedAmountVnd: order.amountVnd,
        callbackAmount: Number.isFinite(vnpAmount) ? vnpAmount : null,
        responseCode: '04',
      });
      return { RspCode: '04', Message: 'Invalid Amount' };
    }

    // 5. Check response code & transaction status
    const isSuccess =
      params.vnp_ResponseCode === '00' &&
      (params.vnp_TransactionStatus === '00' || !params.vnp_TransactionStatus);

    let payDate: Date | null = null;
    if (params.vnp_PayDate && params.vnp_PayDate.length === 14) {
      const y = parseInt(params.vnp_PayDate.substring(0, 4), 10);
      const m = parseInt(params.vnp_PayDate.substring(4, 6), 10) - 1;
      const d = parseInt(params.vnp_PayDate.substring(6, 8), 10);
      const h = parseInt(params.vnp_PayDate.substring(8, 10), 10);
      const min = parseInt(params.vnp_PayDate.substring(10, 12), 10);
      const s = parseInt(params.vnp_PayDate.substring(12, 14), 10);
      payDate = new Date(Date.UTC(y, m, d, h - 7, min, s));
    }

    const transitioned = await this.paymentOrderRepo.updatePendingOrder(
      orderCode,
      isSuccess ? PaymentOrderStatus.COMPLETED : PaymentOrderStatus.FAILED,
      {
        transactionNo: params.vnp_TransactionNo ?? null,
        bankCode: params.vnp_BankCode ?? null,
        responseCode: params.vnp_ResponseCode ?? null,
        ...(isSuccess ? { payDate: payDate ?? new Date() } : {}),
      },
    );

    if (!transitioned) {
      this.log(`payment.${command.source}.duplicate`, {
        transactionReference: orderCode,
        status: 'already_transitioned',
        responseCode: '02',
      });
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    this.log(`payment.${command.source}.transitioned`, {
      transactionReference: orderCode,
      amountVnd: order.amountVnd,
      status: isSuccess
        ? PaymentOrderStatus.COMPLETED
        : PaymentOrderStatus.FAILED,
      responseCode: params.vnp_ResponseCode ?? 'unknown',
      transactionNo: params.vnp_TransactionNo ?? 'unknown',
    });

    return { RspCode: '00', Message: 'Confirm Success' };
  }

  private log(
    event: string,
    details: Record<string, string | number | null>,
  ): void {
    const message = JSON.stringify({ event, ...details });
    if (event.endsWith('.rejected')) {
      this.logger.warn(message);
      return;
    }
    this.logger.log(message);
  }
}
