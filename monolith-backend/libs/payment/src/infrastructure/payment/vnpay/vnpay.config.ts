export interface VNPayConfig {
  tmnCode: string;
  hashSecret: string;
  paymentUrl: string;
  returnUrl: string;
  ipnUrl: string;
  frontendUrl: string;
}

export function getVNPayConfig(): VNPayConfig {
  const required = [
    'VNPAY_TMN_CODE',
    'VNPAY_HASH_SECRET',
    'VNPAY_PAYMENT_URL',
    'VNPAY_RETURN_URL',
    'VNPAY_IPN_URL',
    'FRONTEND_URL',
  ] as const;

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing environment variable: ${key}`);
    }
  }

  return {
    tmnCode: process.env.VNPAY_TMN_CODE!,
    hashSecret: process.env.VNPAY_HASH_SECRET!,
    paymentUrl: process.env.VNPAY_PAYMENT_URL!,
    returnUrl: process.env.VNPAY_RETURN_URL!,
    ipnUrl: process.env.VNPAY_IPN_URL!,
    frontendUrl: process.env.FRONTEND_URL!,
  };
}
