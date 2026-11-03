import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './auth.store';
import type { User } from '../types/auth.types';

describe('useAuthStore', () => {
  const dummyUser: User = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    role: 'DEVELOPER',
  };

  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().logout();
  });

  it('initializes with unauthenticated state when localStorage is empty', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('updates state and localStorage on login', () => {
    useAuthStore.getState().login('access-token-123', 'refresh-token-456', dummyUser);

    const state = useAuthStore.getState();
    expect(state.token).toBe('access-token-123');
    expect(state.refreshToken).toBe('refresh-token-456');
    expect(state.user).toEqual(dummyUser);
    expect(state.isAuthenticated).toBe(true);

    expect(localStorage.getItem('flowpilot_token')).toBe('access-token-123');
    expect(localStorage.getItem('flowpilot_refresh_token')).toBe('refresh-token-456');
    expect(JSON.parse(localStorage.getItem('flowpilot_user') || '{}')).toEqual(dummyUser);
  });

  it('updates only tokens on setTokens', () => {
    useAuthStore.getState().login('access-token-123', 'refresh-token-456', dummyUser);
    useAuthStore.getState().setTokens('new-access-token', 'new-refresh-token');

    const state = useAuthStore.getState();
    expect(state.token).toBe('new-access-token');
    expect(state.refreshToken).toBe('new-refresh-token');
    expect(state.user).toEqual(dummyUser);

    expect(localStorage.getItem('flowpilot_token')).toBe('new-access-token');
    expect(localStorage.getItem('flowpilot_refresh_token')).toBe('new-refresh-token');
  });

  it('clears state and localStorage on logout', () => {
    useAuthStore.getState().login('access-token-123', 'refresh-token-456', dummyUser);
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);

    expect(localStorage.getItem('flowpilot_token')).toBeNull();
    expect(localStorage.getItem('flowpilot_refresh_token')).toBeNull();
    expect(localStorage.getItem('flowpilot_user')).toBeNull();
  });
});

