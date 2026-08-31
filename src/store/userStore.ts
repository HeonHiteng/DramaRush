import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import type { MockUser } from '@/types';
import { supabase } from '@/lib/supabase';
import { DEFAULT_GUEST_NAME } from '@/config';
import { asyncStorageAdapter, STORAGE_KEYS } from './storage';

interface UserState {
  user: MockUser | null;
  hasOnboarded: boolean;
  isAuthenticating: boolean;
  hasHydrated: boolean;
  authError: string | null;
  completeOnboarding: () => void;
  /** Each resolves to whether it succeeded — `authError` is also set on
   * failure for screens that just render it, but callers that need to
   * branch on the outcome (e.g. deciding whether to navigate) don't have to
   * go read it back out of the store to find out. */
  signInAsGuest: () => Promise<boolean>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  upgradeGuestAccount: (name: string, email: string, password: string) => Promise<boolean>;
  signInWithOAuth: (provider: 'google' | 'apple') => Promise<boolean>;
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

/** Every sign-in/sign-up action below (except OAuth, whose multi-step,
 * multi-return-point flow doesn't fit this shape) follows the same pattern:
 * flip `isAuthenticating` on, run one Supabase auth call, translate its
 * error into `authError`, flip `isAuthenticating` back off. Pulling that
 * out once means a change to the pattern (e.g. logging, retry) happens in
 * one place instead of four. */
async function runAuthAction(
  set: (partial: Partial<UserState>) => void,
  action: () => Promise<{ error: unknown }>
): Promise<boolean> {
  set({ isAuthenticating: true, authError: null });
  const { error } = await action();
  set({ isAuthenticating: false, authError: error ? friendlyAuthError(error) : null });
  return !error;
}

/** updateUser() only writes auth.users' metadata — the profiles row (where
 * display_name actually gets read from; see loadMockUser in AuthListener)
 * was seeded once at guest sign-up with DEFAULT_GUEST_NAME and won't pick up
 * a new name on its own. AuthListener also won't re-run for a plain table
 * write like this one (no auth event fires), so the in-memory user is
 * patched directly too instead of waiting on a refresh that isn't coming. */
async function syncGuestDisplayName(set: (fn: (state: UserState) => Partial<UserState>) => void, userId: string, name: string) {
  await supabase.from('profiles').update({ display_name: name }).eq('user_id', userId);
  set((state) => (state.user ? { user: { ...state.user, displayName: name } } : {}));
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

      signInAsGuest: () =>
        runAuthAction(set, () =>
          supabase.auth.signInAnonymously({
            options: { data: { provider: 'guest', display_name: DEFAULT_GUEST_NAME } },
          })
        ),

      signUpWithEmail: (name, email, password) =>
        runAuthAction(set, () =>
          supabase.auth.signUp({ email, password, options: { data: { provider: 'email', display_name: name } } })
        ),

      signInWithEmail: (email, password) => runAuthAction(set, () => supabase.auth.signInWithPassword({ email, password })),

      // Attaches real credentials to the *current* (anonymous) session via
      // updateUser, rather than signUp, which would create a brand-new
      // auth.users row and silently orphan the guest's wallet/unlocks/
      // history — updateUser keeps the same user id, so everything already
      // tied to it carries over.
      upgradeGuestAccount: async (name, email, password) => {
        let updatedUserId: string | undefined;
        const ok = await runAuthAction(set, async () => {
          const { data, error } = await supabase.auth.updateUser({
            email,
            password,
            data: { provider: 'email', display_name: name },
          });
          updatedUserId = data.user?.id;
          return { error };
        });
        if (ok && updatedUserId) {
          await syncGuestDisplayName(set, updatedUserId, name);
        }
        return ok;
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
            return true;
          }

          const { data, error } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo, skipBrowserRedirect: true },
          });
          if (error) throw error;
          if (!data?.url) throw new Error('The sign-in provider did not return a URL.');

          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
          if (result.type !== 'success' || !result.url) {
            // User cancelled/dismissed the provider's screen — not an error.
            set({ isAuthenticating: false });
            return false;
          }

          const code = new URL(result.url).searchParams.get('code');
          if (!code) throw new Error('No authorization code was returned.');

          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;

          set({ isAuthenticating: false });
          return true;
        } catch (error) {
          set({ isAuthenticating: false, authError: friendlyAuthError(error) });
          return false;
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
