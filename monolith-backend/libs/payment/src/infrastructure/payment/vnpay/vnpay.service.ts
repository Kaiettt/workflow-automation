import { Injectable } from '@nestjs/common';
import { VNPayUtil } from './vnpay.util';
import { getVNPayConfig, VNPayConfig } from './vnpay.config';
import {
  VNPayCallbackParams,
  VNPayCreatePaymentParams,
  VNPayPaymentResult,
} from './vnpay.types';

@Injectable()
export class VNPayService {
  private readonly config: VNPayConfig = getVNPayConfig();

  createPaymentUrl(request: VNPayCreatePaymentParams): string {
    const { transactionReference, amount, orderInfo, ipAddress } = request;

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error('Invalid payment amount');
    }

    const now = new Date();

    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.config.tmnCode,
      vnp_Amount: String(amount * 100),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: transactionReference,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: this.config.returnUrl,
      vnp_IpAddr: ipAddress || '127.0.0.1',
      vnp_CreateDate: this.formatVNPayDate(now),
      vnp_ExpireDate: this.formatVNPayDate(
        new Date(now.getTime() + 15 * 60 * 1000),
      ),
    };

    const hashData = VNPayUtil.buildHashData(params);

    const secureHash = VNPayUtil.hmacSHA512(this.config.hashSecret, hashData);

    const queryString = VNPayUtil.buildQueryString(params);

    return (
      `${this.config.paymentUrl}?${queryString}` +
      `&vnp_SecureHash=${secureHash}`
    );
  }

  verifyCallback(callback: Record<string, string>): boolean {
    const receivedHash = callback.vnp_SecureHash;

    if (!receivedHash) {
      return false;
    }

    const params = { ...callback };

    delete params.vnp_SecureHash;
    delete params.vnp_SecureHashType;

    const calculatedHash = VNPayUtil.getHash(params, this.config.hashSecret);

    return VNPayUtil.verifySignature(calculatedHash, receivedHash);
  }

  processCallback(callback: Record<string, string>): VNPayPaymentResult {
    const signatureValid = this.verifyCallback(callback);
    const cb = callback as unknown as VNPayCallbackParams;
    const amount = Number(cb.vnp_Amount) / 100;

    const successful =
      signatureValid &&
      cb.vnp_ResponseCode === '00' &&
      cb.vnp_TransactionStatus === '00';

    return {
      signatureValid,
      transactionReference: cb.vnp_TxnRef,
      transactionId: cb.vnp_TransactionNo,
      amount,
      responseCode: cb.vnp_ResponseCode,
      transactionStatus: cb.vnp_TransactionStatus,
      successful,
    };
  }

  private formatVNPayDate(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);

    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );

    return (
      values.year +
      values.month +
      values.day +
      values.hour +
      values.minute +
      values.second
    );
  }
}
