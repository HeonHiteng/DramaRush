import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import type { AppUser } from '@/types';
import type { TranslationKey } from '@/i18n/translations';
import { supabase } from '@/lib/supabase';
import { DEFAULT_GUEST_NAME } from '@/config';
import { asyncStorageAdapter, STORAGE_KEYS } from './storage';

interface UserState {
  user: AppUser | null;
  hasOnboarded: boolean;
  isAuthenticating: boolean;
  hasHydrated: boolean;
  /**
   * True once AuthListener has finished handling the first auth event —
   * either a restored session (and its profile) or "no session". Until then
   * `user === null` means "don't know yet", not "signed out", so nothing may
   * create a guest on the strength of it (that used to replace a real
   * account with a new guest on slow networks).
   */
  sessionChecked: boolean;
  /** Set by signOut() so AuthListener can tell a SIGNED_OUT the user asked
   * for from one Supabase raised on its own (refresh token revoked, account
   * deleted elsewhere) — only the latter triggers recovery. */
  signOutRequested: boolean;
  /** Set after a guest successfully links Google or a phone; Profile shows
   * the one-time "account linked" modal and clears it. */
  pendingWelcome: boolean;
  /** An i18n key (screens translate it), never raw server text. */
  authError: TranslationKey | null;
  completeOnboarding: () => void;
  /** Each resolves to whether it succeeded — `authError` is also set on
   * failure for screens that just render it, but callers that need to
   * branch on the outcome (e.g. deciding whether to navigate) don't have to
   * go read it back out of the store to find out. */
  signInAsGuest: () => Promise<boolean>;
  signInWithOAuth: (provider: 'google' | 'apple') => Promise<boolean>;
  /** Sends a 6-digit code to `phone` over WhatsApp. Call verifyPhoneOtp with
   * the code the user receives to actually complete sign-in. */
  signInWithPhoneOtp: (phone: string) => Promise<boolean>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<boolean>;
  /**
   * Guest-upgrade counterparts of signInWithOAuth / signInWithPhoneOtp: they
   * attach the Google login or phone number to the *current* (anonymous)
   * account rather than signing into a new one, so the user id — and with it
   * the guest's unlocks and history — stays the same.
   */
  linkOAuthIdentity: (provider: 'google') => Promise<boolean>;
  linkPhoneOtp: (phone: string) => Promise<boolean>;
  verifyLinkedPhoneOtp: (phone: string, token: string) => Promise<boolean>;
  /** Renames the signed-in user (1–40 characters). Resolves to an i18n error key, or null on success. */
  updateDisplayName: (name: string) => Promise<TranslationKey | null>;
  /** Signs this device out only (`scope: 'local'`): a global sign-out would
   * also kick the same account off every other phone and browser. */
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  /** Called by AuthListener whenever Supabase's session changes. */
  setSessionUser: (user: AppUser | null) => void;
  setHasHydrated: (v: boolean) => void;
}

function errorField(error: unknown, field: 'code' | 'message' | 'status'): unknown {
  return error && typeof error === 'object' ? (error as Record<string, unknown>)[field] : undefined;
}

/**
 * Maps a Supabase auth error (or an OAuth redirect's error/error_code
 * params) to an i18n key. Raw server text is English-only and sometimes
 * useless — supabase-js reports auth-server 5xx responses with the HTTP
 * Response object stringified as the message, literally "{}" — so it's
 * logged for debugging and the user sees one of our own messages instead.
 */
export function authErrorKey(error: unknown): TranslationKey {
  const code = String(errorField(error, 'code') ?? '');
  const message = String(errorField(error, 'message') ?? (typeof error === 'string' ? error : '')).toLowerCase();
  const status = Number(errorField(error, 'status'));

  if (
    ['identity_already_exists', 'phone_exists', 'email_exists', 'user_already_exists'].includes(code) ||
    message.includes('already been registered') ||
    message.includes('already linked') ||
    message.includes('already exists')
  ) {
    return 'auth.alreadyLinked';
  }
  if (status === 429 || code.startsWith('over_') || message.includes('rate limit')) return 'auth.tooManyAttempts';
  if (code === 'otp_expired' || message.includes('token has expired') || message.includes('invalid otp')) return 'auth.invalidCode';
  if (code === 'validation_failed' && message.includes('phone')) return 'auth.invalidPhone';
  if (message.includes('invalid phone')) return 'auth.invalidPhone';

  console.warn('auth error', error);
  return 'auth.genericError';
}

/** "+60 12-345 6789" -> "+60123456789": Supabase rejects spaces and dashes in phone numbers. */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  return (trimmed.startsWith('+') ? '+' : '') + trimmed.replace(/\D/g, '');
}

/** Every sign-in action below (except OAuth, whose multi-step,
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
  set({ isAuthenticating: false, authError: error ? authErrorKey(error) : null });
  return !error;
}

type OAuthStart = (options: { redirectTo: string; skipBrowserRedirect: boolean }) => Promise<{
  data: { url?: string | null } | null;
  error: unknown;
}>;

/** Pulls `error_code` / `error_description` out of a provider redirect, which
 * Supabase puts in the query string or the fragment depending on the flow. */
export function redirectError(url: string): { code?: string; message: string } | null {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  parsed.searchParams.forEach((value, key) => params.set(key, value));
  const message = params.get('error_description') ?? params.get('error');
  if (!message) return null;
  return { code: params.get('error_code') ?? undefined, message };
}

/**
 * The browser round-trip shared by OAuth sign-in and OAuth identity linking:
 * on web, a full-page redirect (/auth/callback finishes the PKCE exchange
 * when the page reloads at `redirectTo`); on native, an in-app auth
 * session whose returned code is exchanged for a session here.
 */
async function runOAuthFlow(
  set: (partial: Partial<UserState>) => void,
  start: OAuthStart,
  { linking }: { linking: boolean }
): Promise<boolean> {
  set({ isAuthenticating: true, authError: null });
  try {
    const redirectTo = Linking.createURL('auth/callback');

    if (Platform.OS === 'web') {
      // The page is about to unload, taking this store with it: leave a note
      // for /auth/callback so it knows the round trip was a guest bind.
      if (linking) await AsyncStorage.setItem(STORAGE_KEYS.oauthLink, '1');
      else await AsyncStorage.removeItem(STORAGE_KEYS.oauthLink);
      const { data, error } = await start({ redirectTo, skipBrowserRedirect: false });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      return true;
    }

    const { data, error } = await start({ redirectTo, skipBrowserRedirect: true });
    if (error) throw error;
    if (!data?.url) throw new Error('no_provider_url');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) {
      // User cancelled/dismissed the provider's screen — not an error.
      set({ isAuthenticating: false });
      return false;
    }

    // e.g. identity_already_exists when that Google account already has its
    // own KBbox account — the provider comes back with an error, not a code.
    const providerError = redirectError(result.url);
    if (providerError) throw providerError;

    const code = new URL(result.url).searchParams.get('code');
    if (!code) throw new Error('no_authorization_code');

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;

    set({ isAuthenticating: false, ...(linking ? { pendingWelcome: true } : null) });
    return true;
  } catch (error) {
    if (Platform.OS === 'web') await AsyncStorage.removeItem(STORAGE_KEYS.oauthLink);
    set({ isAuthenticating: false, authError: authErrorKey(error) });
    return false;
  }
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      hasOnboarded: false,
      isAuthenticating: false,
      hasHydrated: false,
      sessionChecked: false,
      signOutRequested: false,
      pendingWelcome: false,
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

      // Supabase generates the code; its "Send SMS" auth hook hands it to our
      // shared otp-hub service, which delivers it over WhatsApp (Meta Cloud
      // API). So: no `channel` option — 'whatsapp' would make Supabase look
      // for a Twilio WhatsApp sender — and verification stays `type: 'sms'`.
      signInWithPhoneOtp: (phone) => runAuthAction(set, () => supabase.auth.signInWithOtp({ phone: normalizePhone(phone) })),

      verifyPhoneOtp: (phone, token) =>
        runAuthAction(set, () => supabase.auth.verifyOtp({ phone: normalizePhone(phone), token, type: 'sms' })),

      updateDisplayName: async (name) => {
        const user = get().user;
        const trimmed = name.trim();
        if (!user) return 'profile.notSignedIn';
        if (trimmed.length < 1 || trimmed.length > 40) return 'profile.nameLength';
        // RLS turns an update of someone else's (or a missing) row into
        // "0 rows, no error" — asking for the row back is how that shows up.
        const { data, error } = await supabase
          .from('profiles')
          .update({ display_name: trimmed })
          .eq('user_id', user.id)
          .select('user_id');
        if (error || !data || data.length === 0) {
          if (error) console.warn('updateDisplayName failed', error);
          return 'profile.nameSaveFailed';
        }
        // No auth event fires for a plain table write, so AuthListener won't
        // reload the profile: patch the in-memory user directly.
        set({ user: { ...user, displayName: trimmed } });
        return null;
      },

      signInWithOAuth: (provider) =>
        runOAuthFlow(set, (options) => supabase.auth.signInWithOAuth({ provider, options }), { linking: false }),

      // Requires "Allow manual linking" in the Supabase project's auth
      // settings; without it the server refuses and the error shows inline.
      linkOAuthIdentity: (provider) =>
        runOAuthFlow(set, (options) => supabase.auth.linkIdentity({ provider, options }), { linking: true }),

      // A phone *change* on the current user: the code goes to the new
      // number and is verified with type 'phone_change' (not 'sms', which is
      // for signing in). Like signInWithPhoneOtp it goes out through the Send
      // SMS hook (otp-hub delivers it on WhatsApp), so no `channel` option.
      linkPhoneOtp: (phone) => runAuthAction(set, () => supabase.auth.updateUser({ phone: normalizePhone(phone) })),

      verifyLinkedPhoneOtp: async (phone, token) => {
        const ok = await runAuthAction(set, () =>
          supabase.auth.verifyOtp({ phone: normalizePhone(phone), token, type: 'phone_change' })
        );
        if (ok) set({ pendingWelcome: true });
        return ok;
      },

      signOut: async () => {
        set({ signOutRequested: true });
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        // On failure no SIGNED_OUT event follows, so nobody else will clear
        // the flag — and a stale one would swallow a later real expiry.
        if (error) {
          console.warn('signOut failed', error);
          set({ signOutRequested: false });
        }
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
