import { createHmac, timingSafeEqual } from 'node:crypto';

// X-Hub-Signature-256 = "sha256=" + HMAC-SHA256 of the exact request bytes,
// keyed with the app secret.
export function isValidMetaSignature(
  rawBody: Buffer | undefined,
  signature: string | undefined,
  appSecret: string | undefined,
): boolean {
  if (!rawBody || !signature || !appSecret) return false;
  const expected = Buffer.from(
    `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`,
  );
  const received = Buffer.from(signature.trim());
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}
