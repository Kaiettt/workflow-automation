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
  otp: string;
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

export interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    user: User;
  };
  message?: string;
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

