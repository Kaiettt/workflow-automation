import { Injectable, Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VNPayService } from '../../infrastructure/payment/vnpay/vnpay.service';
import {
  HandleVNPayIpnCommand,
  VNPayIpnResponse,
} from './handle-vnpay-ipn.command';

export class VerifyVNPayReturnCommand {
  constructor(public readonly params: Record<string, string>) {}
}

export interface VerifyReturnResult {
  transactionReference: string;
  signatureValid: boolean;
  successful: boolean;
}

@Injectable()
@CommandHandler(VerifyVNPayReturnCommand)
export class VerifyVNPayReturnHandler implements ICommandHandler<
  VerifyVNPayReturnCommand,
  VerifyReturnResult
> {
  private readonly logger = new Logger(VerifyVNPayReturnHandler.name);

  constructor(
    private readonly vnpayService: VNPayService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(
    command: VerifyVNPayReturnCommand,
  ): Promise<VerifyReturnResult> {
    const { params } = command;
    const signatureValid = this.vnpayService.verifyCallback(params);
    const transactionReference = params.vnp_TxnRef || '';
    const settlement = signatureValid
      ? await this.commandBus.execute<HandleVNPayIpnCommand, VNPayIpnResponse>(
          new HandleVNPayIpnCommand(params, 'return'),
        )
      : null;
    const successful =
      signatureValid &&
      params.vnp_ResponseCode === '00' &&
      (params.vnp_TransactionStatus === '00' || !params.vnp_TransactionStatus);

    this.logger.log(
      JSON.stringify({
        event: 'payment.return.verified',
        transactionReference,
        signatureValid,
        responseCode: params.vnp_ResponseCode ?? 'unknown',
        transactionStatus: params.vnp_TransactionStatus ?? 'unknown',
        successful,
        settlementResponseCode: settlement?.RspCode ?? 'not_dispatched',
      }),
    );

    return {
      transactionReference,
      signatureValid,
      successful,
    };
  }
}
