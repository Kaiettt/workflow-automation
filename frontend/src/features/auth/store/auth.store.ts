import { create } from 'zustand';
import type { User } from '../types/auth.types';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const STORAGE_KEY_TOKEN = 'flowpilot_token';
const STORAGE_KEY_USER = 'flowpilot_user';

const getInitialState = (): { token: string | null; user: User | null; isAuthenticated: boolean } => {
  try {
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (savedToken && savedUser) {
      return {
        token: savedToken,
        user: JSON.parse(savedUser) as User,
        isAuthenticated: true,
      };
    }
  } catch (error) {
    console.error('Failed to parse saved auth session', error);
  }
  return {
    token: null,
    user: null,
    isAuthenticated: false,
  };
};

export const useAuthStore = create<AuthState>((set) => ({
  ...getInitialState(),

  login: (token: string, user: User) => {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    set({
      token,
      user,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    set({
      token: null,
      user: null,
      isAuthenticated: false,
    });
  },
}));
