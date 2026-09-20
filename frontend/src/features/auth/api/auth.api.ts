import { AxiosError } from 'axios';
import { apiClient } from '../../../shared/api/http-client';
import type {
  AuthResponse,
  LoginCredentials,
  RegisterData,
  User,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  SendRegisterOtpRequest,
  SendRegisterOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
} from '../types/auth.types';

const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (
    error instanceof AxiosError &&
    error.response?.data &&
    typeof error.response.data === 'object' &&
    'message' in error.response.data
  ) {
    return String(error.response.data.message);
  }
  return fallback;
};

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      const res = await apiClient.post<AuthResponse>('/auth/login', credentials);
      return res.data;
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Login failed'), {
        cause: error,
      });
    }
  },

  sendRegisterOtp: async (
    payload: SendRegisterOtpRequest,
  ): Promise<SendRegisterOtpResponse> => {
    try {
      const res = await apiClient.post<SendRegisterOtpResponse>(
        '/auth/send-register-otp',
        payload,
      );
      return res.data;
    } catch (error: unknown) {
      throw new Error(
        extractErrorMessage(error, 'Failed to send verification code'),
        { cause: error },
      );
    }
  },

  verifyOtp: async (
    payload: VerifyOtpRequest,
  ): Promise<VerifyOtpResponse> => {
    try {
      const res = await apiClient.post<VerifyOtpResponse>(
        '/auth/verify-otp',
        payload,
      );
      return res.data;
    } catch (error: unknown) {
      throw new Error(
        extractErrorMessage(error, 'Invalid or expired verification code'),
        { cause: error },
      );
    }
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    try {
      const res = await apiClient.post<AuthResponse>('/auth/register', data);
      return res.data;
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Registration failed'), {
        cause: error,
      });
    }
  },

  refreshToken: async (
    payload: RefreshTokenRequest,
  ): Promise<RefreshTokenResponse> => {
    try {
      const res = await apiClient.post<RefreshTokenResponse>(
        '/auth/refresh',
        payload,
      );
      return res.data;
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Failed to refresh token'), {
        cause: error,
      });
    }
  },

  getMe: async (): Promise<{ success: boolean; data: User }> => {
    try {
      const res = await apiClient.get<{ success: boolean; data: User }>('/auth/me');
      return res.data;
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Failed to fetch user profile'), {
        cause: error,
      });
    }
  },

  forgotPassword: async (
    payload: ForgotPasswordRequest,
  ): Promise<ForgotPasswordResponse> => {
    try {
      const res = await apiClient.post<ForgotPasswordResponse>(
        '/auth/forgot-password',
        payload,
      );
      return res.data;
    } catch (error: unknown) {
      throw new Error(
        extractErrorMessage(error, 'Failed to send reset code'),
        { cause: error },
      );
    }
  },

  resetPassword: async (
    payload: ResetPasswordRequest,
  ): Promise<ResetPasswordResponse> => {
    try {
      const res = await apiClient.post<ResetPasswordResponse>(
        '/auth/reset-password',
        payload,
      );
      return res.data;
    } catch (error: unknown) {
      throw new Error(extractErrorMessage(error, 'Failed to reset password'), {
        cause: error,
      });
    }
  },
};
