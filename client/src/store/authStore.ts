import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, AuthState } from '@/types';
import api from '@/lib/api';

interface AuthStore extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  checkAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (username: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await api.post('/auth/login', { username, password });
          
          if (response.data.success) {
            const { token, user } = response.data;
            set({
              token,
              user,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            throw new Error(response.data.error || 'Login failed');
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        // Clear ALL auth storage across both systems
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('licenseKey');
        localStorage.removeItem('trialActive');
        localStorage.removeItem('userCurrency');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      setUser: (user: User) => {
        set({ user });
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) return false;

        try {
          const response = await api.get('/auth/me');
          if (response.data.success) {
            set({ user: response.data.user, isAuthenticated: true });
            return true;
          }
          return false;
        } catch {
          set({ user: null, token: null, isAuthenticated: false });
          return false;
        }
      },
    }),
    {
      name: 'foodstream-auth',
      storage: createJSONStorage(() => sessionStorage), // Use sessionStorage instead of localStorage for better security
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
