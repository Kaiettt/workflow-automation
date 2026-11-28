import { createHmac, timingSafeEqual } from 'node:crypto';

export class VNPayUtil {
  /**
   * Sort parameters alphabetically and URL-encode their values.
   * This follows the VNPay Node.js integration sample.
   */
  static sortAndEncode(params: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {};

    for (const key of Object.keys(params).sort()) {
      if (
        params[key] !== null &&
        params[key] !== undefined &&
        params[key] !== ''
      ) {
        sorted[key] = encodeURIComponent(String(params[key])).replace(
          /%20/g,
          '+',
        );
      }
    }

    return sorted;
  }

  /**
   * Build the canonical signing string.
   */
  static buildHashData(params: Record<string, string>): string {
    const sorted = this.sortAndEncode(params);

    return Object.keys(sorted)
      .map((key) => `${key}=${sorted[key]}`)
      .join('&');
  }

  /**
   * Generate HMAC-SHA512 signature.
   */
  static hmacSHA512(secret: string, data: string): string {
    return createHmac('sha512', secret).update(data, 'utf8').digest('hex');
  }

  /**
   * Verify signatures using constant-time comparison.
   */
  static verifySignature(
    calculatedHash: string,
    receivedHash: string,
  ): boolean {
    if (!calculatedHash || !receivedHash) {
      return false;
    }

    const expected = Buffer.from(calculatedHash.toLowerCase(), 'hex');
    const received = Buffer.from(receivedHash.toLowerCase(), 'hex');

    if (expected.length === 0 || expected.length !== received.length) {
      return false;
    }

    return timingSafeEqual(expected, received);
  }

  /**
   * Build the query string from already sorted and encoded values.
   * Do not encode the values a second time.
   */
  static buildQueryString(params: Record<string, string>): string {
    const sorted = this.sortAndEncode(params);

    return Object.keys(sorted)
      .map((key) => `${encodeURIComponent(key)}=${sorted[key]}`)
      .join('&');
  }

  static getHash(params: Record<string, string>, secret: string): string {
    return this.hmacSHA512(secret, this.buildHashData(params));
  }
}
