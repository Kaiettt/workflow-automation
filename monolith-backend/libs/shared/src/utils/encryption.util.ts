import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export class EncryptionUtil {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12;
  private static readonly AUTH_TAG_LENGTH = 16;

  static encrypt(text: string, keyHex: string): string {
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
      throw new Error('Encryption key must be 32 bytes (64 hex characters)');
    }

    const iv = randomBytes(this.IV_LENGTH);
    const cipher = createCipheriv(this.ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  static decrypt(encryptedText: string, keyHex: string): string {
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
      throw new Error('Encryption key must be 32 bytes (64 hex characters)');
    }

    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
