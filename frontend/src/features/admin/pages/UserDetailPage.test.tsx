import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { adminService } from '../services/admin.service';
import type { Account } from '../types/admin.types';
import { UserDetailPage } from './UserDetailPage';

vi.mock('../services/admin.service', () => ({ adminService: { user: vi.fn(), workflows: vi.fn(), change: vi.fn() } }));
const account: Account = { id: 'client', name: 'Client One', email: 'client@example.test', role: 'CLIENT', isActive: true, revision: 3, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', counts: { workflows: 0, credentials: 0, executions: 0 } };
let queryClient: QueryClient;
function mount() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/admin/users/client']}><Routes><Route path="/admin/users/:id" element={<UserDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.getState().login('token', 'refresh', { id: 'admin', name: 'Admin', email: 'admin@example.test', role: 'ADMIN' });
  vi.mocked(adminService.user).mockResolvedValue(account);
  vi.mocked(adminService.workflows).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  vi.mocked(adminService.change).mockResolvedValue(account);
});
afterEach(() => { cleanup(); queryClient?.clear(); useAuthStore.getState().logout(); });
describe('Account administration', () => {
  it('requires a trimmed reason before sending a change and waits for the server', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Suspend account' }));
    const confirm = screen.getByRole('button', { name: 'Confirm change' });
    expect(confirm.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByLabelText('Reason (5–500 characters)'), { target: { value: '   abc   ' } });
    expect(confirm.hasAttribute('disabled')).toBe(true);
    let resolveChange!: (value: Account) => void;
    vi.mocked(adminService.change).mockImplementation(() => new Promise((resolve) => { resolveChange = resolve; }));
    fireEvent.change(screen.getByLabelText('Reason (5–500 characters)'), { target: { value: '  Suspend account  ' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(adminService.change).toHaveBeenCalledWith(account, { isActive: false }, 'Suspend account'));
    expect(screen.queryByText('Account updated successfully.')).toBeNull();
    await act(async () => resolveChange({ ...account, isActive: false, revision: 4 }));
    expect(await screen.findByText('Account updated successfully.')).toBeTruthy();
  });
  it('sends the revision and direction reviewed in the dialog after a background refresh', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Suspend account' }));
    vi.mocked(adminService.user).mockResolvedValue({ ...account, isActive: false, revision: 4 });
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'user', 'client'] }); });
    fireEvent.change(screen.getByLabelText('Reason (5–500 characters)'), { target: { value: 'Reviewed suspension' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }));
    await waitFor(() => expect(adminService.change).toHaveBeenCalledWith(account, { isActive: false }, 'Reviewed suspension'));
  });
  it('reloads a conflict and never retries the mutation with a new revision', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Change to Admin' }));
    const error = new AxiosError('Conflict');
    error.response = { status: 409, statusText: 'Conflict', headers: {}, config: { headers: new AxiosHeaders() }, data: { code: 'STALE_REVISION' } };
    vi.mocked(adminService.change).mockRejectedValue(error);
    vi.mocked(adminService.user).mockResolvedValue({ ...account, role: 'ADMIN', revision: 4 });
    fireEvent.change(screen.getByLabelText('Reason (5–500 characters)'), { target: { value: 'Grant administrative access' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }));
    expect(await screen.findByText(/Account information has been refreshed/)).toBeTruthy();
    expect(adminService.change).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Change to Client' })).toBeTruthy();
  });
  it('blocks self changes and promotion of an inactive account', async () => {
    useAuthStore.getState().updateUser({ id: 'client', name: 'Client', email: 'client@example.test', role: 'CLIENT' });
    mount();
    expect((await screen.findByRole('button', { name: 'Suspend account' })).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Change to Admin' }).hasAttribute('disabled')).toBe(true);
    await act(async () => {
      useAuthStore.getState().updateUser({ id: 'admin', name: 'Admin', email: 'admin@example.test', role: 'ADMIN' });
      queryClient.setQueryData(['admin', 'user', 'client'], { ...account, isActive: false });
    });
    expect(screen.getByRole('button', { name: 'Reactivate account' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Change to Admin' }).hasAttribute('disabled')).toBe(true);
    await act(async () => { queryClient.setQueryData(['admin', 'user', 'client'], { ...account, role: 'ADMIN', isActive: false }); });
    expect(screen.getByRole('button', { name: 'Change to Client' }).hasAttribute('disabled')).toBe(false);
  });
});
