import { create } from 'zustand';
import type { AuthUser } from '@collabboard/shared';
import { authApi } from '../lib/api/auth.api';
import { setAccessToken, setUnauthorizedHandler } from '../lib/apiClient';
import { disconnectSocket } from '../lib/socketClient';

interface AuthState {
  user: AuthUser | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  setUnauthorizedHandler(() => {
    set({ user: null, status: 'unauthenticated' });
    disconnectSocket();
  });

  return {
    user: null,
    status: 'idle',
    error: null,

    bootstrap: async () => {
      set({ status: 'loading' });
      try {
        const { user } = await authApi.me();
        set({ user, status: 'authenticated', error: null });
      } catch {
        set({ user: null, status: 'unauthenticated' });
      }
    },

    login: async (email, password) => {
      set({ status: 'loading', error: null });
      try {
        const result = await authApi.login({ email, password });
        setAccessToken(result.accessToken);
        set({ user: result.user, status: 'authenticated' });
      } catch (err) {
        set({ status: 'unauthenticated', error: (err as Error).message });
        throw err;
      }
    },

    register: async (name, email, password) => {
      set({ status: 'loading', error: null });
      try {
        const result = await authApi.register({ name, email, password });
        setAccessToken(result.accessToken);
        set({ user: result.user, status: 'authenticated' });
      } catch (err) {
        set({ status: 'unauthenticated', error: (err as Error).message });
        throw err;
      }
    },

    logout: async () => {
      await authApi.logout().catch(() => undefined);
      setAccessToken(null);
      disconnectSocket();
      set({ user: null, status: 'unauthenticated' });
    },
  };
});
