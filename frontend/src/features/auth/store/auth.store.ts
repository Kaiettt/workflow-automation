import { create } from 'zustand';
import type { User } from '../types/auth.types';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, refreshToken: string, user: User) => void;
  setTokens: (token: string, refreshToken: string) => void;
  logout: () => void;
}

const STORAGE_KEY_TOKEN = 'flowpilot_token';
const STORAGE_KEY_REFRESH_TOKEN = 'flowpilot_refresh_token';
const STORAGE_KEY_USER = 'flowpilot_user';

const getInitialState = (): {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
} => {
  try {
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const savedRefreshToken = localStorage.getItem(STORAGE_KEY_REFRESH_TOKEN);
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (savedToken && savedUser) {
      return {
        token: savedToken,
        refreshToken: savedRefreshToken,
        user: JSON.parse(savedUser) as User,
        isAuthenticated: true,
      };
    }
  } catch (error) {
    console.error('Failed to parse saved auth session', error);
  }
  return {
    token: null,
    refreshToken: null,
    user: null,
    isAuthenticated: false,
  };
};

export const useAuthStore = create<AuthState>((set) => ({
  ...getInitialState(),

  login: (token: string, refreshToken: string, user: User) => {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, refreshToken);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    set({
      token,
      refreshToken,
      user,
      isAuthenticated: true,
    });
  },

  setTokens: (token: string, refreshToken: string) => {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, refreshToken);
    set({
      token,
      refreshToken,
    });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    set({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  },
}));
