import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '@/features/auth/api/auth.api';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { AdminGuard } from './AdminGuard';

vi.mock('@/features/auth/api/auth.api', () => ({ authApi: { getMe: vi.fn() } }));
let client: QueryClient;
const admin = { id: 'admin', name: 'Admin', email: 'admin@example.test', role: 'ADMIN' as const, isActive: true };
function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/admin']}><Routes><Route path="/" element={<p>Home</p>} /><Route element={<AdminGuard />}><Route path="/admin" element={<p>Admin content</p>} /></Route></Routes></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => { vi.resetAllMocks(); useAuthStore.getState().login('token', 'refresh', admin); });
afterEach(() => { cleanup(); client?.clear(); useAuthStore.getState().logout(); });
describe('Admin route access', () => {
  it('checks the server before rendering privileged content', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ success: true, data: admin });
    mount();
    expect(screen.queryByText('Admin content')).toBeNull();
    expect(await screen.findByText('Admin content')).toBeTruthy();
  });
  it('denies a current Client even if persisted state says Admin', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ success: true, data: { ...admin, role: 'CLIENT' } });
    mount();
    expect(await screen.findByText('You do not have access to the Admin area.')).toBeTruthy();
    expect(screen.queryByText('Admin content')).toBeNull();
  });
  it('lets the user retry a failed session lookup', async () => {
    vi.mocked(authApi.getMe).mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValue({ success: true, data: admin });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Admin content')).toBeTruthy();
  });
  it('redirects unauthenticated visitors without querying Admin data', async () => {
    useAuthStore.getState().logout();
    mount();
    expect(await screen.findByText('Home')).toBeTruthy();
    expect(authApi.getMe).not.toHaveBeenCalled();
  });
});
