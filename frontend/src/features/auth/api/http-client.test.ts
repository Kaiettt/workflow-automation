import axios, { AxiosError, type AxiosResponse } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { apiClient } from '@/shared/api/http-client';
import { useAuthStore } from '../store/auth.store';

interface RefreshEnvelope { success: boolean; data: { accessToken: string; refreshToken: string } }
const originalAdapter = apiClient.defaults.adapter;
const admin = { id: 'admin', name: 'Admin', email: 'admin@example.test', role: 'ADMIN' as const };
beforeEach(() => {
  useAuthStore.getState().login('old-access', 'old-refresh', admin);
  apiClient.defaults.adapter = async (config) => {
    throw new AxiosError('Unauthorized', 'ERR_BAD_RESPONSE', config, undefined, { status: 401, statusText: 'Unauthorized', data: {}, headers: {}, config });
  };
});
afterEach(() => { vi.restoreAllMocks(); apiClient.defaults.adapter = originalAdapter; useAuthStore.getState().logout(); });
describe('Session revocation in the HTTP client', () => {
  it('logs out when refresh is denied and does not retry forever', async () => {
    const refresh = vi.spyOn(axios, 'post').mockRejectedValue(new Error('Refresh revoked'));
    await expect(apiClient.get('/api/admin/users')).rejects.toThrow('Refresh revoked');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().token).toBeNull();
  });
  it('does not restore a session if refresh completes after logout', async () => {
    let resolveRefresh!: (response: AxiosResponse<RefreshEnvelope>) => void;
    const refresh = vi.spyOn(axios, 'post').mockReturnValue(new Promise((resolve) => { resolveRefresh = resolve; }));
    const pending = apiClient.get('/api/admin/users').catch((error: unknown) => error);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    useAuthStore.getState().logout();
    resolveRefresh({ data: { success: true, data: { accessToken: 'late-access', refreshToken: 'late-refresh' } }, status: 200, statusText: 'OK', headers: {}, config: { headers: new axios.AxiosHeaders() } });
    expect(axios.isCancel(await pending)).toBe(true);
    expect(useAuthStore.getState().token).toBeNull();
  });
  it('does not log out a new account when the previous account refresh fails', async () => {
    let rejectRefresh!: (error: Error) => void;
    const refresh = vi.spyOn(axios, 'post').mockReturnValue(new Promise((_resolve, reject) => { rejectRefresh = reject; }));
    const pending = apiClient.get('/api/admin/users').catch((error: unknown) => error);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    useAuthStore.getState().login('new-access', 'new-refresh', { ...admin, id: 'client', role: 'CLIENT' });
    rejectRefresh(new Error('Previous session revoked'));
    await pending;
    expect(useAuthStore.getState().token).toBe('new-access');
  });
});
