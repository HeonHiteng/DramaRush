import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthProvider, MockUser } from '@/types';
import { asyncStorageAdapter, STORAGE_KEYS } from './storage';

interface UserState {
  user: MockUser | null;
  hasOnboarded: boolean;
  isAuthenticating: boolean;
  hasHydrated: boolean;
  completeOnboarding: () => void;
  signIn: (provider: AuthProvider, displayName?: string, email?: string) => Promise<void>;
  signOut: () => void;
  resetUser: () => void;
  setHasHydrated: (v: boolean) => void;
}

function buildUser(provider: AuthProvider, displayName?: string, email?: string): MockUser {
  const names: Record<AuthProvider, string> = {
    guest: 'Guest Viewer',
    email: displayName?.trim() || 'DramaRush Member',
    google: 'Alex (Google)',
    apple: 'Alex (Apple)',
  };
  return {
    id: `mock-${provider}-${Date.now()}`,
    displayName: names[provider],
    email: provider === 'email' ? email : provider === 'guest' ? undefined : `alex.${provider}@example.com`,
    avatarSeed: names[provider],
    provider,
    createdAt: new Date().toISOString(),
  };
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      hasOnboarded: false,
      isAuthenticating: false,
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      completeOnboarding: () => set({ hasOnboarded: true }),
      signIn: async (provider, displayName, email) => {
        set({ isAuthenticating: true });
        await new Promise((resolve) => setTimeout(resolve, 900));
        set({ user: buildUser(provider, displayName, email), isAuthenticating: false });
      },
      signOut: () => set({ user: null }),
      resetUser: () => set({ user: null, hasOnboarded: false, isAuthenticating: false }),
    }),
    {
      name: STORAGE_KEYS.user,
      storage: asyncStorageAdapter,
      partialize: (state) => ({ user: state.user, hasOnboarded: state.hasOnboarded }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
