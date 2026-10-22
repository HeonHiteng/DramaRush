import { useEffect } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { clearPlaybackCache } from '@/services/playback';
import { DEFAULT_GUEST_NAME, DEFAULT_MEMBER_NAME } from '@/config';
import { recoverGuestSession } from '@/utils/autoGuestSignIn';
import { useUserStore } from './userStore';
import { useLibraryStore } from './libraryStore';
import { useWalletStore } from './walletStore';
import { useSubscriptionStore } from './subscriptionStore';
import { useSearchStore } from './searchStore';
import type { AuthProvider, AppUser } from '@/types';

const PROVIDERS: readonly AuthProvider[] = ['guest', 'email', 'phone', 'google', 'apple'];

function isProvider(value: unknown): value is AuthProvider {
  return typeof value === 'string' && (PROVIDERS as readonly string[]).includes(value);
}

/** Device guests (the guest-session Edge Function) are ordinary email users
 * under a synthetic address on this domain — never shown, never a "real"
 * email sign-in. */
const DEVICE_GUEST_EMAIL_DOMAIN = '@guest.kbbox.app';

function isDeviceGuestEmail(email: string | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(DEVICE_GUEST_EMAIL_DOMAIN);
}

/**
 * Whether the session belongs to a guest, from the session alone: an
 * anonymous user, or a device guest that hasn't linked Google or a phone yet
 * (linking adds that identity; the synthetic email stays). profiles.provider
 * remains the source of truth once it has loaded.
 */
export function isGuestSession(session: Session): boolean {
  if (session.user.is_anonymous) return true;
  if (!isDeviceGuestEmail(session.user.email)) return false;
  return !(session.user.identities ?? []).some((identity) => identity.provider !== 'email');
}

/** Only used until (or if) the profiles row can't be read: profiles.provider,
 * which the backend keeps in sync with the account's identities, is the
 * source of truth — app_metadata goes stale when a guest links an identity. */
function sessionProvider(session: Session): AuthProvider {
  if (isGuestSession(session)) return 'guest';
  const provider = session.user.app_metadata?.provider;
  return isProvider(provider) && provider !== 'guest' ? provider : 'email';
}

/** What we can say about the user from the session alone, shown while the
 * profiles row loads — so `user` is never null while a session exists. */
function provisionalUser(session: Session): AppUser {
  const provider = sessionProvider(session);
  const name = provider === 'guest' ? DEFAULT_GUEST_NAME : DEFAULT_MEMBER_NAME;
  return {
    id: session.user.id,
    displayName: name,
    email: (!isDeviceGuestEmail(session.user.email) && session.user.email) || undefined,
    phone: session.user.phone || undefined,
    avatarSeed: name,
    provider,
    createdAt: session.user.created_at,
    isAdmin: false,
  };
}

async function loadAppUser(session: Session): Promise<AppUser> {
  const base = provisionalUser(session);
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_seed, is_admin, public_code, provider')
    .eq('user_id', session.user.id)
    .maybeSingle();

  const provider = isProvider(profile?.provider) ? profile.provider : base.provider;
  const fallbackName = provider === 'guest' ? DEFAULT_GUEST_NAME : DEFAULT_MEMBER_NAME;
  return {
    ...base,
    displayName: profile?.display_name ?? fallbackName,
    publicCode: profile?.public_code ?? undefined,
    avatarSeed: profile?.avatar_seed ?? profile?.display_name ?? fallbackName,
    provider,
    isAdmin: profile?.is_admin ?? false,
  };
}

/** Drops everything cached for the previous account: per-user stores,
 * react-query (the admin screens cache draft episodes there) and signed
 * playback URLs, which were issued for the previous user's entitlements. */
function clearUserData() {
  useLibraryStore.getState().resetLocal();
  useWalletStore.getState().resetLocal();
  useSubscriptionStore.getState().resetLocal();
  useSearchStore.getState().resetLocal();
  queryClient.clear();
  clearPlaybackCache();
}

function hydrateStores() {
  return Promise.all([
    useLibraryStore.getState().hydrateFromServer(),
    useWalletStore.getState().hydrateFromServer(),
    useSubscriptionStore.getState().hydrateFromServer(),
    useSearchStore.getState().hydrateFromServer(),
  ]);
}

/** A SIGNED_OUT nobody asked for: the refresh token was revoked or the
 * account removed. A guest is signed back in where they are (a device guest
 * gets the same account back, an anonymous one a fresh guest); a member is
 * sent to sign in again. */
async function recoverFromUnexpectedSignOut(wasGuest: boolean) {
  if (wasGuest) {
    await recoverGuestSession();
    return;
  }
  useUserStore.setState({ authError: 'auth.sessionExpired' });
  router.replace('/auth');
}

/**
 * Keeps `useUserStore`'s `user` in sync with the Supabase session and
 * hydrates/clears the per-user stores. Exported apart from the component so
 * tests can drive it with a fake auth emitter.
 *
 * Only onAuthStateChange is used (its INITIAL_SESSION event covers startup),
 * so the restored session is handled once, not once more via getSession().
 * Each event gets a sequence number; when a newer event has arrived by the
 * time an older one's profile query returns, the older result is dropped —
 * otherwise a slow load for account A could land after account B signed in.
 */
export function startAuthListener(): () => void {
  let seq = 0;
  let disposed = false;
  // undefined until the first event: "not known yet" differs from "signed out".
  let lastUserId: string | null | undefined;
  let lastWasGuest = false;

  async function handle(event: AuthChangeEvent, session: Session | null) {
    const mySeq = ++seq;
    const isCurrent = () => !disposed && mySeq === seq;
    const prevUserId = lastUserId;
    const prevWasGuest = lastWasGuest;
    const nextUserId = session?.user.id ?? null;
    lastUserId = nextUserId;
    lastWasGuest = !!session && isGuestSession(session);

    if (!session) {
      if (prevUserId) clearUserData();
      useUserStore.setState({ user: null, sessionChecked: true });
      if (event === 'SIGNED_OUT' && prevUserId) {
        const requested = useUserStore.getState().signOutRequested;
        useUserStore.setState({ signOutRequested: false });
        if (!requested) await recoverFromUnexpectedSignOut(prevWasGuest);
      }
      return;
    }

    const sameUser = prevUserId === nextUserId;
    // A refreshed access token for the same account changes nothing we
    // show; re-reading every store on each hourly refresh was pure load.
    if (sameUser && event === 'TOKEN_REFRESHED') return;

    if (!sameUser) {
      // The first event finds the stores empty — nothing to clear yet.
      if (prevUserId !== undefined) clearUserData();
      useUserStore.setState({ user: provisionalUser(session) });
    }

    // Same user with SIGNED_IN / USER_UPDATED (e.g. a guest just linked
    // Google): the profile's provider and name and the wallet's welcome
    // bonus have changed server-side, so reload without clearing first.
    const user = await loadAppUser(session);
    if (!isCurrent()) return;
    useUserStore.setState({ user, sessionChecked: true });

    await hydrateStores();
    // The store hydrates read the signed-in user themselves, so ones that
    // started before a newer event may have written the previous account's
    // data after that event's own hydrates finished. Run them once more for
    // whoever is signed in now.
    if (!disposed && lastUserId && lastUserId !== session.user.id) await hydrateStores();
  }

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    // Not awaited: supabase-js holds its auth lock while notifying, and the
    // queries in handle() need that lock to read the session.
    void handle(event, session);
  });

  return () => {
    disposed = true;
    data.subscription.unsubscribe();
  };
}

/** Mounted once at the app root. */
export function AuthListener() {
  useEffect(() => startAuthListener(), []);
  return null;
}
