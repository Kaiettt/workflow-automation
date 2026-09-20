export type UserRole = 'ADMIN' | 'DEVELOPER' | 'BUSINESS_USER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  otp?: string;
  role?: UserRole;
}

export interface SendRegisterOtpRequest {
  email: string;
}

export interface SendRegisterOtpResponse {
  success: boolean;
  data: {
    success: boolean;
    message: string;
  };
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
  type: 'REGISTER' | 'FORGOT_PASSWORD';
}

export interface VerifyOtpResponse {
  success: boolean;
  data: {
    success: boolean;
    message: string;
  };
}

export interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    user: User;
  };
  message?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  data: {
    success: boolean;
    message: string;
  };
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  data: {
    success: boolean;
    message: string;
  };
}

