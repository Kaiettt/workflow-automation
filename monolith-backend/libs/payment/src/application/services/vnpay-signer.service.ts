import * as crypto from 'crypto';

export class VNPaySigner {
  static sign(
    params: Record<string, string | number>,
    hashSecret: string,
  ): string {
    const canonical = this.buildCanonicalQuery(params);
    return crypto
      .createHmac('sha512', hashSecret)
      .update(Buffer.from(canonical, 'utf-8'))
      .digest('hex');
  }

  static verify(
    params: Record<string, string | number>,
    receivedHash: string,
    hashSecret: string,
  ): boolean {
    const filtered: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(params)) {
      if (
        key !== 'vnp_SecureHash' &&
        key !== 'vnp_SecureHashType' &&
        value !== null &&
        value !== undefined &&
        value !== ''
      ) {
        filtered[key] = value;
      }
    }
    const calculatedHash = this.sign(filtered, hashSecret);
    return calculatedHash.toLowerCase() === (receivedHash || '').toLowerCase();
  }

  static buildCanonicalQuery(params: Record<string, string | number>): string {
    const sortedKeys = Object.keys(params)
      .filter(
        (k) =>
          params[k] !== null && params[k] !== undefined && params[k] !== '',
      )
      .sort();

    const parts = sortedKeys.map((key) => {
      const encodedKey = encodeURIComponent(key);
      const encodedValue = encodeURIComponent(String(params[key]));
      return `${encodedKey}=${encodedValue}`;
    });

    return parts.join('&');
  }
}
