import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/auth.store';

const mockAuthApi = vi.hoisted(() => ({
  login: vi.fn(),
}));

vi.mock('../api/auth.api', () => ({
  authApi: mockAuthApi,
}));

import { LoginForm } from './LoginForm';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ComponentProps } from 'react';
let queryClient: QueryClient;
function renderLoginForm(props: ComponentProps<typeof LoginForm> = {}) {
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><Routes><Route path="/" element={<LoginForm {...props} />} /><Route path="/admin" element={<p>Admin dashboard</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
  });

  afterEach(() => { cleanup(); queryClient?.clear(); });

  it('renders input fields and submit button', () => {
    renderLoginForm();
    expect(screen.getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(screen.getByPlaceholderText('••••••••')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeTruthy();
  });

  it('submits credentials and signs the user in on success', async () => {
    const onSuccess = vi.fn();
    const mockUser = {
      id: 'usr-1',
      email: 'admin@flowpilot.local',
      name: 'Admin User',
      role: 'ADMIN' as const,
    };

    mockAuthApi.login.mockResolvedValue({
      success: true,
      data: {
        accessToken: 'access-token-abc',
        refreshToken: 'refresh-token-xyz',
        user: mockUser,
      },
    });

    renderLoginForm({ onSuccess });

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'admin@flowpilot.local' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Password123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockAuthApi.login).toHaveBeenCalledWith({
        email: 'admin@flowpilot.local',
        password: 'Password123!',
      });
      expect(onSuccess).toHaveBeenCalled();
      expect(screen.getByText('Admin dashboard')).toBeTruthy();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });
  });

  it('displays error message when login fails', async () => {
    mockAuthApi.login.mockRejectedValue(new Error('Invalid email or password'));

    renderLoginForm();

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'wrong@flowpilot.local' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'wrongpass' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeTruthy();
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('triggers onSwitchToRegister and onForgotPassword when corresponding buttons are clicked', () => {
    const onSwitchToRegister = vi.fn();
    const onForgotPassword = vi.fn();

    renderLoginForm({ onSwitchToRegister, onForgotPassword });

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(onForgotPassword).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(onSwitchToRegister).toHaveBeenCalledTimes(1);
  });
  it('keeps Client login in the workspace instead of opening Admin', async () => {
    mockAuthApi.login.mockResolvedValue({ success: true, data: { accessToken: 'client-access', refreshToken: 'client-refresh', user: { id: 'client', name: 'Client', email: 'client@example.test', role: 'CLIENT', isActive: true } } });
    const onSuccess = vi.fn();
    renderLoginForm({ onSuccess });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'client@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(screen.queryByText('Admin dashboard')).toBeNull();
  });

});

