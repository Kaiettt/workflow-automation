import { VNPaySigner } from '@app/payment/application/services/vnpay-signer.service';

describe('VNPaySigner (Ticket 3 - Task 3.2)', () => {
  const secretKey = 'RAOEXHYVSDDIIENYWSLDIIZTANXUXZFJ';

  it('should build canonical query string with ASCII sorted keys and URL-encoded values', () => {
    const params = {
      vnp_TmnCode: 'FLOWPILOT',
      vnp_Amount: 10000000,
      vnp_Command: 'pay',
      vnp_OrderInfo: 'Nap tien FlowPilot',
    };

    const canonical = VNPaySigner.buildCanonicalQuery(params);
    expect(canonical).toBe(
      'vnp_Amount=10000000&vnp_Command=pay&vnp_OrderInfo=Nap%20tien%20FlowPilot&vnp_TmnCode=FLOWPILOT',
    );
  });

  it('should generate valid HMAC-SHA512 checksum', () => {
    const params = {
      vnp_Amount: 10000000,
      vnp_Command: 'pay',
      vnp_OrderInfo: 'Nap tien FlowPilot',
      vnp_TmnCode: 'FLOWPILOT',
    };

    const hash = VNPaySigner.sign(params, secretKey);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(128); // SHA-512 hex is 128 characters
  });

  it('should verify signature correctly and reject invalid or tampered signatures', () => {
    const params = {
      vnp_Amount: 10000000,
      vnp_Command: 'pay',
      vnp_OrderInfo: 'Nap tien FlowPilot',
      vnp_TmnCode: 'FLOWPILOT',
    };

    const validHash = VNPaySigner.sign(params, secretKey);

    const fullParamsWithHash = {
      ...params,
      vnp_SecureHash: validHash,
      vnp_SecureHashType: 'SHA512',
    };

    expect(VNPaySigner.verify(fullParamsWithHash, validHash, secretKey)).toBe(
      true,
    );

    expect(
      VNPaySigner.verify(fullParamsWithHash, 'tampered_hash_123', secretKey),
    ).toBe(false);

    expect(
      VNPaySigner.verify(
        { ...fullParamsWithHash, vnp_Amount: 99999999 },
        validHash,
        secretKey,
      ),
    ).toBe(false);
  });
});
