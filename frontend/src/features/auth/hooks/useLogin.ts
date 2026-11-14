import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import type { LoginCredentials } from '../types/auth.types';

export function useLogin() {
  return useMutation({ mutationFn: (credentials: LoginCredentials) => authApi.login(credentials) });
}
