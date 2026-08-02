import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import type { MockUser } from '@/types';
import { supabase } from '@/lib/supabase';
import { asyncStorageAdapter, STORAGE_KEYS } from './storage';

interface UserState {
  user: MockUser | null;
  hasOnboarded: boolean;
  isAuthenticating: boolean;
  hasHydrated: boolean;
  authError: string | null;
  completeOnboarding: () => void;
  signInAsGuest: () => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'apple') => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  /** Called by AuthListener whenever Supabase's session changes. */
  setSessionUser: (user: MockUser | null) => void;
  setHasHydrated: (v: boolean) => void;
}

function friendlyAuthError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong signing in. Please try again.';
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      hasOnboarded: false,
      isAuthenticating: false,
      hasHydrated: false,
      authError: null,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      completeOnboarding: () => set({ hasOnboarded: true }),
      clearAuthError: () => set({ authError: null }),
      setSessionUser: (user) => set({ user }),

      signInAsGuest: async () => {
        set({ isAuthenticating: true, authError: null });
        const { error } = await supabase.auth.signInAnonymously({
          options: { data: { provider: 'guest', display_name: 'Guest Viewer' } },
        });
        set({ isAuthenticating: false, authError: error ? friendlyAuthError(error) : null });
      },

      signUpWithEmail: async (name, email, password) => {
        set({ isAuthenticating: true, authError: null });
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { provider: 'email', display_name: name } },
        });
        set({ isAuthenticating: false, authError: error ? friendlyAuthError(error) : null });
      },

      signInWithEmail: async (email, password) => {
        set({ isAuthenticating: true, authError: null });
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        set({ isAuthenticating: false, authError: error ? friendlyAuthError(error) : null });
      },

      signInWithOAuth: async (provider) => {
        set({ isAuthenticating: true, authError: null });
        try {
          const redirectTo = Linking.createURL('auth/callback');

          if (Platform.OS === 'web') {
            // Full-page redirect; Supabase's client picks the session up
            // from the URL when the page reloads at `redirectTo`.
            const { data, error } = await supabase.auth.signInWithOAuth({
              provider,
              options: { redirectTo },
            });
            if (error) throw error;
            if (data?.url) window.location.href = data.url;
            return;
          }

          const { data, error } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo, skipBrowserRedirect: true },
          });
          if (error) throw error;
          if (!data?.url) throw new Error('The sign-in provider did not return a URL.');

          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
          if (result.type !== 'success' || !result.url) {
            set({ isAuthenticating: false });
            return;
          }

          const code = new URL(result.url).searchParams.get('code');
          if (!code) throw new Error('No authorization code was returned.');

          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;

          set({ isAuthenticating: false });
        } catch (error) {
          set({ isAuthenticating: false, authError: friendlyAuthError(error) });
        }
      },

      signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null });
      },
    }),
    {
      name: STORAGE_KEYS.user,
      storage: asyncStorageAdapter,
      // `user` is derived from the Supabase session (see AuthListener), not
      // persisted independently — Supabase's own client already persists
      // the session. Only the device-local onboarding flag lives here.
      partialize: (state) => ({ hasOnboarded: state.hasOnboarded }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
