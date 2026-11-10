import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'authToken';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  // Signed-in admin's name from the web app, printed as the cashier
  userName: string | null;
  hydrate: () => Promise<void>;
  setToken: (token: string | null) => void;
  setUserName: (name: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  isAuthenticated: false,
  isHydrated: false,
  userName: null,

  // Restore the token saved from the last session so native screens work before the WebView syncs
  hydrate: async () => {
    try {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      // A token synced from the WebView while we were reading wins over the saved one
      if (saved && !get().token) {
        set({ token: saved, isAuthenticated: true });
      }
    } catch (err) {
      console.warn('Failed to restore auth token:', err);
    } finally {
      set({ isHydrated: true });
    }
  },

  setToken: (token) => {
    if (token === get().token) return;
    set({
      token,
      isAuthenticated: !!token,
    });
    const persist = token
      ? SecureStore.setItemAsync(TOKEN_KEY, token)
      : SecureStore.deleteItemAsync(TOKEN_KEY);
    persist.catch((err) => console.warn('Failed to persist auth token:', err));
  },

  setUserName: (userName) => set({ userName }),

  logout: () => {
    set({ userName: null });
    get().setToken(null);
  },
}));
