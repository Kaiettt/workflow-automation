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

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
  });

  afterEach(cleanup);

  it('renders input fields and submit button', () => {
    render(<LoginForm />);
    expect(screen.getByPlaceholderText('developer@flowpilot.local')).toBeTruthy();
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

    render(<LoginForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText('developer@flowpilot.local'), {
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
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });
  });

  it('displays error message when login fails', async () => {
    mockAuthApi.login.mockRejectedValue(new Error('Invalid email or password'));

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText('developer@flowpilot.local'), {
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

    render(
      <LoginForm
        onSwitchToRegister={onSwitchToRegister}
        onForgotPassword={onForgotPassword}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(onForgotPassword).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(onSwitchToRegister).toHaveBeenCalledTimes(1);
  });
});

