import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import type { UserAttributes } from '@supabase/supabase-js';
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
  /** Sends a 6-digit code to `phone` over WhatsApp. Call verifyPhoneOtp with
   * the code the user receives to actually complete sign-in. */
  signInWithPhoneOtp: (phone: string) => Promise<boolean>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<boolean>;
  /**
   * Guest-upgrade counterparts of signInWithOAuth / signInWithPhoneOtp: they
   * attach the Google login or phone number to the *current* (anonymous)
   * account rather than signing into a new one, so the guest's wallet,
   * unlocks and history stay theirs — the same reason upgradeGuestAccount
   * uses updateUser instead of signUp.
   */
  linkOAuthIdentity: (provider: 'google') => Promise<boolean>;
  linkPhoneOtp: (phone: string) => Promise<boolean>;
  verifyLinkedPhoneOtp: (phone: string, token: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  /** Called by AuthListener whenever Supabase's session changes. */
  setSessionUser: (user: MockUser | null) => void;
  setHasHydrated: (v: boolean) => void;
}

function friendlyAuthError(error: unknown): string {
  // supabase-js reports auth-server 5xx responses with the HTTP Response
  // object stringified as the message — literally "{}" — so the server's own
  // reason never reaches us. Show something readable instead of "{}".
  if (error instanceof Error && error.message && error.message !== '{}') return error.message;
  return 'Something went wrong signing in. Please try again.';
}

/** "+60 12-345 6789" -> "+60123456789": Supabase rejects spaces and dashes in phone numbers. */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  return (trimmed.startsWith('+') ? '+' : '') + trimmed.replace(/\D/g, '');
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

type OAuthStart = (options: { redirectTo: string; skipBrowserRedirect: boolean }) => Promise<{
  data: { url?: string | null } | null;
  error: unknown;
}>;

/**
 * The browser round-trip shared by OAuth sign-in and OAuth identity linking:
 * on web, a full-page redirect (Supabase's client picks the session up from
 * the URL when the page reloads at `redirectTo`); on native, an in-app auth
 * session whose returned code is exchanged for a session here.
 */
async function runOAuthFlow(set: (partial: Partial<UserState>) => void, start: OAuthStart): Promise<boolean> {
  set({ isAuthenticating: true, authError: null });
  try {
    const redirectTo = Linking.createURL('auth/callback');

    if (Platform.OS === 'web') {
      const { data, error } = await start({ redirectTo, skipBrowserRedirect: false });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      return true;
    }

    const { data, error } = await start({ redirectTo, skipBrowserRedirect: true });
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

      // Supabase generates the code; its "Send SMS" auth hook hands it to our
      // shared otp-hub service, which delivers it over WhatsApp (Meta Cloud
      // API). So: no `channel` option — 'whatsapp' would make Supabase look
      // for a Twilio WhatsApp sender — and verification stays `type: 'sms'`.
      signInWithPhoneOtp: (phone) => runAuthAction(set, () => supabase.auth.signInWithOtp({ phone: normalizePhone(phone) })),

      verifyPhoneOtp: (phone, token) =>
        runAuthAction(set, () => supabase.auth.verifyOtp({ phone: normalizePhone(phone), token, type: 'sms' })),

      signInWithOAuth: (provider) =>
        runOAuthFlow(set, (options) => supabase.auth.signInWithOAuth({ provider, options })),

      // Requires "Allow manual linking" in the Supabase project's auth
      // settings; without it the server refuses and the error shows inline.
      linkOAuthIdentity: (provider) => runOAuthFlow(set, (options) => supabase.auth.linkIdentity({ provider, options })),

      // A phone *change* on the current user: the code goes to the new
      // number and is verified with type 'phone_change' (not 'sms', which is
      // for signing in). `channel` isn't in supabase-js's UserAttributes type
      // but is forwarded as-is in the PUT /user body. Not yet confirmed that
      // the auth server honours it for phone changes — if it doesn't, the code
      // arrives by SMS instead. Check once a WhatsApp sender is configured.
      linkPhoneOtp: (phone) =>
        runAuthAction(set, () => supabase.auth.updateUser({ phone, channel: 'whatsapp' } as UserAttributes)),

      verifyLinkedPhoneOtp: (phone, token) =>
        runAuthAction(set, () => supabase.auth.verifyOtp({ phone, token, type: 'phone_change' })),

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
