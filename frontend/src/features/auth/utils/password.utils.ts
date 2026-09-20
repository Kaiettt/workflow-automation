export interface PasswordValidationRules {
  length: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isStrong: boolean;
}

export const getPasswordValidation = (password: string): PasswordValidationRules => {
  const length = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  const isStrong = length && hasUpper && hasLower && hasNumber && hasSpecial;

  return {
    length,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    isStrong,
  };
};
