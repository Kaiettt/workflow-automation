import { VNPayService } from '@app/payment/infrastructure/payment/vnpay/vnpay.service';
import { VNPayUtil } from '@app/payment/infrastructure/payment/vnpay/vnpay.util';
import { getVNPayConfig } from '@app/payment/infrastructure/payment/vnpay/vnpay.config';

describe('VNPayService (Ticket 3 - VNPay Integration Guide)', () => {
  let service: VNPayService;

  beforeEach(() => {
    process.env.VNPAY_TMN_CODE = 'DEMOVNPAY';
    process.env.VNPAY_HASH_SECRET = 'SECRETKEYFORHASHING1234567890ABCDEF';
    process.env.VNPAY_PAYMENT_URL =
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    process.env.VNPAY_RETURN_URL =
      'http://localhost:8080/api/billing/vnpay/return';
    process.env.VNPAY_IPN_URL =
      'https://example.ngrok-free.app/api/billing/vnpay/ipn';
    process.env.FRONTEND_URL = 'http://localhost:5173';
    service = new VNPayService();
  });

  it('should generate a valid VNPay payment URL with amount multiplied by 100', () => {
    const url = service.createPaymentUrl({
      transactionReference: 'FP12345678',
      amount: 299000,
      orderInfo: 'Thanh toan FlowPilot PRO',
      ipAddress: '127.0.0.1',
    });

    expect(url).toContain(
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?',
    );
    expect(url).toContain('vnp_Amount=29900000');
    expect(url).toContain('vnp_TxnRef=FP12345678');
    expect(url).toContain('vnp_SecureHash=');
  });

  it('should reject non-positive or invalid amounts', () => {
    expect(() =>
      service.createPaymentUrl({
        transactionReference: 'FP12345678',
        amount: 0,
        orderInfo: 'Thanh toan',
        ipAddress: '127.0.0.1',
      }),
    ).toThrow('Invalid payment amount');

    expect(() =>
      service.createPaymentUrl({
        transactionReference: 'FP12345678',
        amount: -50000,
        orderInfo: 'Thanh toan',
        ipAddress: '127.0.0.1',
      }),
    ).toThrow('Invalid payment amount');
  });

  it('should verify valid callback and reject invalid or tampered callback', () => {
    const secret = 'SECRETKEYFORHASHING1234567890ABCDEF';
    const params: Record<string, string> = {
      vnp_Amount: '29900000',
      vnp_BankCode: 'NCB',
      vnp_OrderInfo: 'Thanh+toan',
      vnp_ResponseCode: '00',
      vnp_TmnCode: 'DEMOVNPAY',
      vnp_TransactionNo: '14123456',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: 'FP12345678',
    };

    const hash = VNPayUtil.getHash(params, secret);
    const callbackWithHash = {
      ...params,
      vnp_SecureHash: hash,
    };

    expect(service.verifyCallback(callbackWithHash)).toBe(true);

    const tampered = {
      ...callbackWithHash,
      vnp_Amount: '10000000',
    };
    expect(service.verifyCallback(tampered)).toBe(false);
  });

  it('should reject configuration when a required environment variable is missing', () => {
    const originalValue = process.env.VNPAY_HASH_SECRET;
    delete process.env.VNPAY_HASH_SECRET;

    try {
      expect(() => getVNPayConfig()).toThrow(
        'Missing environment variable: VNPAY_HASH_SECRET',
      );
    } finally {
      process.env.VNPAY_HASH_SECRET = originalValue;
    }
  });
});
