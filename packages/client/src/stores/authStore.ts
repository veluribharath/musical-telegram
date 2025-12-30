import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_URL = 'http://localhost:3001';

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  status: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, displayName: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });

          const data = await response.json();

          if (!response.ok) {
            set({ isLoading: false, error: data.error || 'Login failed' });
            return false;
          }

          set({ user: data.user, token: data.token, isLoading: false });
          return true;
        } catch (error) {
          set({ isLoading: false, error: 'Connection failed. Is the server running?' });
          return false;
        }
      },

      register: async (username: string, password: string, displayName: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, displayName }),
          });

          const data = await response.json();

          if (!response.ok) {
            set({ isLoading: false, error: data.error || 'Registration failed' });
            return false;
          }

          set({ user: data.user, token: data.token, isLoading: false });
          return true;
        } catch (error) {
          set({ isLoading: false, error: 'Connection failed. Is the server running?' });
          return false;
        }
      },

      logout: () => {
        set({ user: null, token: null });
      },

      clearError: () => {
        set({ error: null });
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) return;

        try {
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!response.ok) {
            set({ user: null, token: null });
            return;
          }

          const data = await response.json();
          set({ user: data.user });
        } catch {
          set({ user: null, token: null });
        }
      },
    }),
    {
      name: 'chatterbox-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
