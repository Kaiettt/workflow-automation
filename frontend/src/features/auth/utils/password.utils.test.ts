import { describe, expect, it } from 'vitest';
import { getPasswordValidation } from './password.utils';

describe('getPasswordValidation', () => {
  it('returns all false for an empty password', () => {
    const result = getPasswordValidation('');
    expect(result).toEqual({
      length: false,
      hasUpper: false,
      hasLower: false,
      hasNumber: false,
      hasSpecial: false,
      isStrong: false,
    });
  });

  it('validates minimum length of 8 characters', () => {
    expect(getPasswordValidation('abc').length).toBe(false);
    expect(getPasswordValidation('abcdefgh').length).toBe(true);
  });

  it('validates uppercase letters correctly', () => {
    expect(getPasswordValidation('lowercase').hasUpper).toBe(false);
    expect(getPasswordValidation('lowerCase').hasUpper).toBe(true);
  });

  it('validates lowercase letters correctly', () => {
    expect(getPasswordValidation('UPPERCASE').hasLower).toBe(false);
    expect(getPasswordValidation('UPPERCASe').hasLower).toBe(true);
  });

  it('validates numeric characters correctly', () => {
    expect(getPasswordValidation('noNumbers').hasNumber).toBe(false);
    expect(getPasswordValidation('has1Number').hasNumber).toBe(true);
  });

  it('validates special characters correctly', () => {
    expect(getPasswordValidation('plainText123').hasSpecial).toBe(false);
    expect(getPasswordValidation('symbol!text').hasSpecial).toBe(true);
    expect(getPasswordValidation('symbol@text').hasSpecial).toBe(true);
    expect(getPasswordValidation('symbol#text').hasSpecial).toBe(true);
  });

  it('flags isStrong as true only when all requirements are met', () => {
    // Missing special
    expect(getPasswordValidation('Password123').isStrong).toBe(false);
    // Missing number
    expect(getPasswordValidation('Password!').isStrong).toBe(false);
    // Missing upper
    expect(getPasswordValidation('password123!').isStrong).toBe(false);
    // Missing lower
    expect(getPasswordValidation('PASSWORD123!').isStrong).toBe(false);
    // Too short
    expect(getPasswordValidation('Pass1!').isStrong).toBe(false);

    // Meets all criteria
    expect(getPasswordValidation('P@ssword123').isStrong).toBe(true);
  });
});

