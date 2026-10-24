import { EncryptionUtil } from '@app/shared/utils/encryption.util';
import { randomBytes } from 'crypto';

describe('EncryptionUtil', () => {
  const keyHex = randomBytes(32).toString('hex');

  it('should encrypt and decrypt a string successfully', () => {
    const originalText = 'my-secret-token-123';

    const encrypted = EncryptionUtil.encrypt(originalText, keyHex);
    expect(encrypted).not.toBe(originalText);
    expect(encrypted.split(':').length).toBe(3);

    const decrypted = EncryptionUtil.decrypt(encrypted, keyHex);
    expect(decrypted).toBe(originalText);
  });

  it('should throw an error on invalid key length', () => {
    const invalidKeyHex = '1234';
    expect(() => EncryptionUtil.encrypt('test', invalidKeyHex)).toThrow();
    expect(() => EncryptionUtil.decrypt('test', invalidKeyHex)).toThrow();
  });

  it('should throw an error on decryption if data is tampered with', () => {
    const encrypted = EncryptionUtil.encrypt('test', keyHex);
    // Change the last character for certain; a fixed '0' left the data as it was
    // about one run in sixteen, because the last hex digit is random.
    const last = encrypted.slice(-1);
    const tampered = encrypted.slice(0, -1) + (last === '0' ? '1' : '0');

    expect(() => EncryptionUtil.decrypt(tampered, keyHex)).toThrow();
  });
});
